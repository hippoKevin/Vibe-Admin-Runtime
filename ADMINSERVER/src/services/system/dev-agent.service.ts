import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { GenerateCodeDto } from 'src/dto/system/dev-agent/dev-agent.dto';

/** 单次任务的超时时间（毫秒），可用 DSH_AGENT_TIMEOUT 覆盖 */
const DEFAULT_TIMEOUT = 5 * 60 * 1000;

/** 返回给前端的内容长度上限（避免长文本塞满页面） */
const STDOUT_LIMIT = 4000;
const STDERR_LIMIT = 1500;

/** dsh 安装目录的候选位置（找不到时可显式设置 DSH_INSTALL_DIR） */
const INSTALL_CANDIDATES = [
    'D:\\software\\deepseek-harness',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'deepseek-harness'),
    path.join(process.env.ProgramFiles || '', 'deepseek-harness'),
];

/** dsh 启动器解析结果 */
interface DshLauncher {
    /** Electron 可执行文件（以 Node 模式运行 cli.js） */
    exe: string;
    /** cli.js 绝对路径 */
    cli: string;
    /** 展示用的完整命令 */
    label: string;
}

/** 一次执行的改动文件 */
export interface DevAgentChangedFile {
    status: string;
    path: string;
}

/** 一次执行的结果 */
export interface DevAgentRunResult {
    ok: boolean;
    exitCode: number | null;
    duration: number;
    /** Agent 的最终答复（已截断） */
    output: string;
    /** 推理过程尾部（stderr，已截断） */
    reasoningTail: string;
    files: DevAgentChangedFile[];
    finishedAt: string;
    error?: string;
}

/** 一条执行历史（独立控制台的「执行过程」面板用） */
export interface DevAgentRunRecord extends DevAgentRunResult {
    id: string;
    prompt: string;
    startedAt: string;
}

/** 最多保留多少条执行历史（内存态，重启即清空） */
const MAX_RUN_HISTORY = 20;

/**
 * 开发模式服务：把一句话任务交给 DeepSeek Harness 执行
 *
 * 底层命令等价于 `dsh --profile headless "<任务>"`：
 * headless 组合包跑一个一次性 Agent，只把最终答复打到 stdout，退出码 0 表示完成。
 * 这里不通过 shell 调 .cmd，而是解析启动器后直接 spawn「Electron.exe + cli.js」，
 * 避免任务文本里的引号/特殊字符造成命令注入。
 */
@Injectable()
export class DevAgentService {
    private readonly logger = new Logger(DevAgentService.name);

    /** 同一时间只允许一个任务在跑 */
    private running = false;

    /** 最近一次执行结果 */
    private lastRun: DevAgentRunResult | null = null;

    /** 执行历史（新的在前） */
    private readonly runs: DevAgentRunRecord[] = [];

    /**
     * 执行历史：给独立控制台的「执行过程」面板用
     */
    getRuns() {
        return {
            running: this.running,
            timeout: this.resolveTimeout(),
            cwd: this.resolveCwd(),
            items: this.runs,
        };
    }

    /**
     * 状态：前端据此判断「开发模式」是否可用
     */
    getStatus() {
        const launcher = this.resolveLauncher();

        return {
            ready: !!launcher,
            cliPath: launcher?.cli ?? null,
            launcher: launcher?.label ?? null,
            cwd: this.resolveCwd(),
            timeout: this.resolveTimeout(),
            running: this.running,
            lastRun: this.lastRun,
            hint: launcher
                ? null
                : '未找到 dsh：请安装 DeepSeek Harness，或设置 DSH_INSTALL_DIR / DSH_CLI_PATH 指向它',
        };
    }

    /**
     * 执行一次生成任务
     * @param dto 任务描述
     */
    async generate(dto: GenerateCodeDto): Promise<DevAgentRunResult> {
        if (this.running) {
            throw new BusinessException('已有一个任务正在执行，请等它结束');
        }

        const launcher = this.resolveLauncher();
        if (!launcher) {
            throw new BusinessException(
                '未找到 dsh：请安装 DeepSeek Harness，或设置 DSH_INSTALL_DIR / DSH_CLI_PATH',
            );
        }

        const cwd = this.resolveCwd(dto.cwd);
        if (!fs.existsSync(cwd)) {
            throw new BusinessException(`执行目录不存在：${cwd}`);
        }

        this.running = true;
        const startedAt = Date.now();

        try {
            // 先记录执行前的工作区状态，好把「这次任务改的」和「原本就有的改动」区分开
            const before = await this.collectChangedFiles(cwd);

            const run = await this.spawnAgent(launcher, cwd, dto.prompt);

            const after = await this.collectChangedFiles(cwd);
            const beforeStatus = new Map(before.map((item) => [item.path, item.status]));
            const files = after.filter((item) => beforeStatus.get(item.path) !== item.status);

            const result: DevAgentRunResult = {
                ok: run.exitCode === 0,
                exitCode: run.exitCode,
                duration: Date.now() - startedAt,
                output: this.tail(run.stdout, STDOUT_LIMIT),
                reasoningTail: this.tail(run.stderr, STDERR_LIMIT),
                files,
                finishedAt: new Date().toISOString(),
                error: run.timedOut ? '执行超时，已被强制结束' : undefined,
            };

            this.lastRun = result;
            this.runs.unshift({
                ...result,
                id: String(startedAt),
                prompt: dto.prompt,
                startedAt: new Date(startedAt).toISOString(),
            });
            if (this.runs.length > MAX_RUN_HISTORY) this.runs.length = MAX_RUN_HISTORY;

            this.logger.log(
                `开发模式任务结束：exit=${result.exitCode} 用时=${result.duration}ms 改动文件=${files.length}`,
            );

            return result;
        } finally {
            this.running = false;
        }
    }

    /**
     * 以「Electron 可执行文件 + cli.js + 参数数组」的方式启动，不经过 shell
     */
    private spawnAgent(launcher: DshLauncher, cwd: string, prompt: string) {
        return new Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }>(
            (resolve, reject) => {
                const args = ['--expose-internals', launcher.cli, '--profile', 'headless', prompt];

                const child = spawn(launcher.exe, args, {
                    cwd,
                    // ELECTRON_RUN_AS_NODE=1 让 Electron 以纯 Node 方式运行 cli.js
                    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
                    windowsHide: true,
                });

                let stdout = '';
                let stderr = '';
                let timedOut = false;

                const timeout = this.resolveTimeout();
                const timer = setTimeout(() => {
                    timedOut = true;
                    this.logger.warn(`开发模式任务超时（${timeout}ms），强制结束进程树`);
                    this.killTree(child.pid);
                }, timeout);

                child.stdout?.on('data', (data) => {
                    stdout += String(data);
                });
                child.stderr?.on('data', (data) => {
                    stderr += String(data);
                });

                child.on('error', (error) => {
                    clearTimeout(timer);
                    reject(new BusinessException(`启动 dsh 失败：${error.message}`));
                });

                child.on('exit', (code) => {
                    clearTimeout(timer);
                    resolve({ exitCode: code, stdout, stderr, timedOut });
                });
            },
        );
    }

    /** 进程树强杀（Windows 下 child.kill 杀不干净它的子进程） */
    private killTree(pid?: number) {
        if (!pid) return;

        try {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', String(pid), '/f', '/t'], { stdio: 'ignore' });
            } else {
                process.kill(-pid, 'SIGTERM');
            }
        } catch (error) {
            this.logger.warn(`结束进程失败：${error?.message || error}`);
        }
    }

    /** 用 git status 列出这次任务改了哪些文件 */
    private collectChangedFiles(cwd: string): Promise<DevAgentChangedFile[]> {
        return new Promise((resolve) => {
            const child = spawn('git', ['status', '--porcelain'], { cwd, windowsHide: true });

            let output = '';
            child.stdout?.on('data', (data) => {
                output += String(data);
            });
            child.on('error', () => resolve([]));
            child.on('exit', () => {
                const files = output
                    .split(/\r?\n/)
                    .filter((line) => line.trim())
                    .map((line) => ({
                        status: line.slice(0, 2).trim(),
                        path: line.slice(3).trim(),
                    }))
                    .filter((item) => item.path);
                resolve(files);
            });
        });
    }

    /**
     * 解析 dsh 启动器
     * 支持：DSH_CLI_PATH 指向 dsh.cmd / DSH_INSTALL_DIR 指向安装目录 / 常见安装位置
     */
    private resolveLauncher(): DshLauncher | null {
        const candidates: string[] = [];

        const explicit = process.env.DSH_CLI_PATH || process.env.DSH_INSTALL_DIR;
        if (explicit) {
            candidates.push(
                explicit.toLowerCase().endsWith('.cmd') || explicit.toLowerCase().endsWith('.exe')
                    ? explicit
                    : path.join(explicit, 'resources', 'runtime', 'cli', 'bin', 'dsh.cmd'),
            );
        }

        for (const dir of INSTALL_CANDIDATES) {
            if (dir && dir.includes('deepseek-harness')) {
                candidates.push(path.join(dir, 'resources', 'runtime', 'cli', 'bin', 'dsh.cmd'));
            }
        }

        // PATH 里的 dsh
        const pathDirs = String(process.env.PATH || '').split(path.delimiter);
        for (const dir of pathDirs) {
            if (dir) candidates.push(path.join(dir, 'dsh.cmd'));
        }

        for (const candidate of candidates) {
            if (!candidate || !fs.existsSync(candidate)) continue;

            const launcher = this.parseLauncher(candidate);
            if (launcher) return launcher;
        }

        return null;
    }

    /**
     * 解析 dsh.cmd：取出其中的 Electron 可执行文件与 cli.js
     * dsh.cmd 形如：
     *   "%~dp0..\..\..\..\DeepSeek Harness.exe" --expose-internals "%~dp0..\..\..\app.asar\dsh\node_modules\...\cli.js" %*
     */
    private parseLauncher(cmdPath: string): DshLauncher | null {
        try {
            const content = fs.readFileSync(cmdPath, 'utf-8');
            const dir = path.dirname(cmdPath);
            const expand = (value: string) => path.resolve(dir, value.replace(/%~dp0/gi, ''));

            const exe = content.match(/"([^"]*\.exe)"/i)?.[1];
            const cli = content.match(/"([^"]*cli\.js)"/i)?.[1];
            if (!exe || !cli) return null;

            const exePath = expand(exe);
            const cliPath = expand(cli);
            if (!fs.existsSync(exePath)) return null;

            // cli.js 可能被打进 app.asar（打包安装），普通 Node 无法 stat 包内路径，
            // 这种情况只校验 .asar 包本身存在，包内解析交给 Electron 运行时。
            const asarMatch = cliPath.match(/^(.*?\.asar)[\\/]/i);
            if (asarMatch) {
                if (!fs.existsSync(asarMatch[1])) return null;
            } else if (!fs.existsSync(cliPath)) {
                return null;
            }

            return { exe: exePath, cli: cliPath, label: `${exePath} --expose-internals ${cliPath}` };
        } catch (error) {
            this.logger.warn(`解析 dsh 启动器失败（${cmdPath}）：${error?.message || error}`);
            return null;
        }
    }

    /** 执行目录：默认仓库根目录（ADMINSERVER 的上一级） */
    private resolveCwd(input?: string): string {
        const target = String(input || process.env.DSH_AGENT_CWD || '').trim();
        if (target) return path.resolve(target);
        return path.resolve(process.cwd(), '..');
    }

    private resolveTimeout(): number {
        const value = Number(process.env.DSH_AGENT_TIMEOUT);
        if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT;
        return Math.min(Math.floor(value), 30 * 60 * 1000);
    }

    /** 只保留末尾若干字符，避免长文本塞满页面 */
    private tail(text: string, limit: number): string {
        const value = String(text || '').trim();
        if (value.length <= limit) return value;
        return `…${value.slice(value.length - limit)}`;
    }
}

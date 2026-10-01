import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { DevAgentChannel, GenerateCodeDto } from 'src/dto/system/dev-agent/dev-agent.dto';

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
    /** 通道：reply 简短回复 / code 后台执行代码 */
    channel: DevAgentChannel;
    /** 是否仍在后台运行中（前端据此显示进度） */
    running?: boolean;
}

/** 最多保留多少条执行历史（内存态，重启即清空） */
const MAX_RUN_HISTORY = 20;

/** 简短回复通道返回的最大长度（TTS 念太长的没意义） */
const REPLY_LIMIT = 600;

/** 简短回复通道的默认超时（比改代码短得多） */
const REPLY_TIMEOUT = 90 * 1000;

/** 同步任务（如 AI 润色单个文档）的默认超时 */
const SYNC_TASK_TIMEOUT = 3 * 60 * 1000;

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

    /** 最近一次执行结果（带 channel/running，前端刷新后也能量对通道样式） */
    private lastRun: DevAgentRunRecord | null = null;

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
     * 入口：按通道分发
     * - reply：简短回复，同步返回最终答复（前端用 TTS 播报）
     * - code：后台执行，立刻返回 runId，前端轮询 /runs 看进度
     */
    async generate(dto: GenerateCodeDto) {
        const channel: DevAgentChannel = dto.channel === 'reply' ? 'reply' : 'code';
        return channel === 'reply' ? this.reply(dto) : this.startBackgroundRun(dto);
    }

    /**
     * 简短回复通道：同步跑一次，只要最终答复
     * 会在 prompt 里明确要求「不要改动任何文件」，跑完仍然对比一次工作区，
     * 万一它擅自改了文件，也会如实报出来。
     */
    private async reply(dto: GenerateCodeDto) {
        const launcher = this.requireLauncher();
        const cwd = this.resolveCwd(dto.cwd);

        this.running = true;
        const startedAt = Date.now();

        try {
            const before = await this.collectChangedFiles(cwd);
            const prompt = [
                'Answer the question below briefly: one or two sentences, in the same language as the question.',
                'Do NOT modify, create or delete any file.',
                '',
                dto.prompt,
            ].join('\n');

            const run = await this.spawnAgent(launcher, cwd, prompt, this.resolveReplyTimeout());
            const after = await this.collectChangedFiles(cwd);
            const beforeStatus = new Map(before.map((item) => [item.path, item.status]));
            const files = after.filter((item) => beforeStatus.get(item.path) !== item.status);

            const answer =
                this.tail(run.stdout, REPLY_LIMIT) ||
                (run.timedOut ? '（回复超时，请重试）' : '（没有拿到回复）');

            const result = {
                channel: 'reply' as const,
                answer,
                ok: run.exitCode === 0,
                exitCode: run.exitCode,
                duration: Date.now() - startedAt,
                files,
                finishedAt: new Date().toISOString(),
            };

            this.pushRun({
                id: String(startedAt),
                channel: 'reply',
                prompt: dto.prompt,
                startedAt: new Date(startedAt).toISOString(),
                running: false,
                ok: result.ok,
                exitCode: result.exitCode,
                duration: result.duration,
                output: answer,
                reasoningTail: this.tail(run.stderr, STDERR_LIMIT),
                files,
                finishedAt: result.finishedAt,
            });

            // 同时记成本次结果，刷新后 /status 也能还原（带 channel，前端才知道用哪个通道的样式展示）
            this.lastRun = {
                ...result,
                id: String(startedAt),
                channel: 'reply',
                prompt: dto.prompt,
                startedAt: new Date(startedAt).toISOString(),
                running: false,
                output: answer,
                reasoningTail: this.tail(run.stderr, STDERR_LIMIT),
            };

            this.logger.log(`开发模式-简短回复：用时=${result.duration}ms 长度=${answer.length} 改动文件=${files.length}`);
            return result;
        } finally {
            this.running = false;
        }
    }

    /**
     * 后台执行通道：立刻返回，任务在后台跑，结果写进执行历史
     */
    private startBackgroundRun(dto: GenerateCodeDto) {
        const launcher = this.requireLauncher();
        const cwd = this.resolveCwd(dto.cwd);

        const startedAt = Date.now();
        const record: DevAgentRunRecord = {
            id: String(startedAt),
            channel: 'code',
            prompt: dto.prompt,
            startedAt: new Date(startedAt).toISOString(),
            running: true,
            ok: false,
            exitCode: null,
            duration: 0,
            output: '',
            reasoningTail: '',
            files: [],
            finishedAt: '',
        };

        // 先占位入历史，前端一提交就能在 /runs 里看到 running 状态
        this.running = true;
        this.pushRun(record);

        // 故意不 await：把控制权立刻交回前端
        void this.executeBackground(launcher, cwd, dto.prompt, record, startedAt);
        this.logger.log(`开发模式-后台任务已启动：id=${record.id}`);

        return {
            channel: 'code' as const,
            runId: record.id,
            started: true,
            running: true,
            startedAt: record.startedAt,
        };
    }

    /** 后台执行体：跑完把结果写回同一条历史记录（前端轮询即可看到状态翻转） */
    private async executeBackground(
        launcher: DshLauncher,
        cwd: string,
        prompt: string,
        record: DevAgentRunRecord,
        startedAt: number,
    ) {
        try {
            const before = await this.collectChangedFiles(cwd);
            const run = await this.spawnAgent(launcher, cwd, prompt, this.resolveTimeout());
            const after = await this.collectChangedFiles(cwd);
            const beforeStatus = new Map(before.map((item) => [item.path, item.status]));

            record.files = after.filter((item) => beforeStatus.get(item.path) !== item.status);
            record.exitCode = run.exitCode;
            record.ok = run.exitCode === 0;
            record.duration = Date.now() - startedAt;
            record.output = this.tail(run.stdout, STDOUT_LIMIT);
            record.reasoningTail = this.tail(run.stderr, STDERR_LIMIT);
            record.finishedAt = new Date().toISOString();
            record.running = false;
            record.error = run.timedOut ? '执行超时，已被强制结束' : undefined;

            this.lastRun = { ...record };
            this.logger.log(
                `开发模式-后台任务结束：id=${record.id} exit=${record.exitCode} 用时=${record.duration}ms 改动文件=${record.files.length}`,
            );
        } catch (error: any) {
            record.running = false;
            record.ok = false;
            record.finishedAt = new Date().toISOString();
            record.error = error?.message || String(error);
            this.logger.error(`开发模式-后台任务失败：id=${record.id} ${record.error}`);
        } finally {
            this.running = false;
        }
    }

    /** 取启动器，取不到就抛业务异常 */
    private requireLauncher(): DshLauncher {
        const launcher = this.resolveLauncher();
        if (!launcher) {
            throw new BusinessException(
                '未找到 dsh：请安装 DeepSeek Harness，或设置 DSH_INSTALL_DIR / DSH_CLI_PATH',
            );
        }
        if (this.running) {
            throw new BusinessException('已有一个任务正在执行，请等它结束');
        }
        return launcher;
    }

    /** 写入一条执行历史（新的在前，超出上限截断） */
    private pushRun(record: DevAgentRunRecord) {
        this.runs.unshift(record);
        if (this.runs.length > MAX_RUN_HISTORY) this.runs.length = MAX_RUN_HISTORY;
        return record;
    }

    /**
     * 同步跑一次会改动文件的一次性任务（「AI 润色」这类）
     *
     * 与两个通道的区别：不等控制台聊天，而是等任务真的跑完再返回结果，
     * 调用方（智能管理的润色按钮）拿到结果后重新拉一次文件内容即可。
     */
    async runSyncTask(prompt: string, timeoutMs: number = SYNC_TASK_TIMEOUT): Promise<DevAgentRunResult> {
        const launcher = this.requireLauncher();
        const cwd = this.resolveCwd();

        this.running = true;
        const startedAt = Date.now();

        try {
            const before = await this.collectChangedFiles(cwd);
            const run = await this.spawnAgent(launcher, cwd, prompt, timeoutMs);
            const after = await this.collectChangedFiles(cwd);
            const beforeStatus = new Map(before.map((item) => [item.path, item.status]));

            const result: DevAgentRunResult = {
                ok: run.exitCode === 0,
                exitCode: run.exitCode,
                duration: Date.now() - startedAt,
                output: this.tail(run.stdout, STDOUT_LIMIT),
                reasoningTail: this.tail(run.stderr, STDERR_LIMIT),
                files: after.filter((item) => beforeStatus.get(item.path) !== item.status),
                finishedAt: new Date().toISOString(),
                error: run.timedOut ? '执行超时，已被强制结束' : undefined,
            };

            this.lastRun = {
                ...result,
                id: String(startedAt),
                channel: 'code',
                prompt,
                startedAt: new Date(startedAt).toISOString(),
                running: false,
            };
            this.pushRun({ ...this.lastRun });

            this.logger.log(`开发模式-同步任务结束：用时=${result.duration}ms 改动文件=${result.files.length}`);
            return result;
        } finally {
            this.running = false;
        }
    }

    /**
     * 以「Electron 可执行文件 + cli.js + 参数数组」的方式启动，不经过 shell
     */
    private spawnAgent(launcher: DshLauncher, cwd: string, prompt: string, timeout: number) {
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

                // 超时由调用方决定：简短回复通道短，改代码通道长
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

    /** 简短回复通道的超时（可用 DSH_REPLY_TIMEOUT 覆盖） */
    private resolveReplyTimeout(): number {
        const value = Number(process.env.DSH_REPLY_TIMEOUT);
        if (!Number.isFinite(value) || value <= 0) return REPLY_TIMEOUT;
        return Math.min(Math.floor(value), 10 * 60 * 1000);
    }

    /** 只保留末尾若干字符，避免长文本塞满页面 */
    private tail(text: string, limit: number): string {
        const value = String(text || '').trim();
        if (value.length <= limit) return value;
        return `…${value.slice(value.length - limit)}`;
    }
}

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
    /**
     * 内容指纹（可选，新增字段，老前端忽略它也不影响）
     *
     * 为什么必须有：任务开始前工作区里本来就有未提交改动的文件（`M`），Agent 把它整体
     * 重写之后 git 状态位**依然是 M** —— 只比状态位会得出「本次没改任何文件」的错误结论
     * （实测 harness 重写了 324 行 index.vue，后端却报 0 个文件，跟随跳转不触发）。
     * 现在指纹一起参与对比：状态位或指纹任一变化都算「本次改动」。
     *
     * 取值：`git hash-object` 的内容哈希（精确）；算不出来时退化成 `stat:<mtime>:<size>`
     * （删掉/读不到的文件），再不行是 `status:<状态位>`。
     */
    fingerprint?: string;
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
    /** DSH 会话 id（前端用它做连续对话） */
    sessionId?: string | null;
}

/** DSH --json 事件（一行一条 NDJSON；字段随事件类型变化，这里只声明常用的几个） */
export interface DshRunEvent {
    type: string;
    phase?: string;
    turn?: number;
    step?: number;
    text?: string;
    name?: string;
    tool?: string;
    status?: string;
    sessionId?: string;
    [key: string]: any;
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
    /** DSH 会话 id：同一条会话可以连续追问（对话体验） */
    sessionId?: string | null;
    /** 运行轨迹（DSH --json 事件流，已限量截断） */
    events?: DshRunEvent[];
    /**
     * files 最近一次被刷新（增量对比到改动文件）的时间
     *
     * 运行中由轮询持续更新，前端据此判断这份列表有多新鲜（也便于排查
     * 「改了文件但界面没反应」到底是后端没扫到还是前端没轮询）。
     */
    filesUpdatedAt?: string;
}

/** 最多保留多少条执行历史（内存态，重启即清空） */
const MAX_RUN_HISTORY = 20;

/** 轨迹最多保留多少条事件（避免长任务把响应体撑爆） */
const MAX_EVENTS = 300;

/** 单条事件里字符串字段的最大长度 */
const EVENT_TEXT_LIMIT = 400;

/** 默认使用的 DSH profile（前端可以覆盖，实现"模式"选择） */
const DEFAULT_PROFILE = 'headless';

/** 简短回复通道返回的最大长度（TTS 念太长的没意义） */
const REPLY_LIMIT = 600;

/** 简短回复通道的默认超时（比改代码短得多） */
const REPLY_TIMEOUT = 90 * 1000;

/**
 * 后台任务运行期间「已经改到哪些文件」的刷新间隔（毫秒）
 *
 * 需求：开发模式跑 code 通道时，Agent 每改到一个前端文件，界面就该跳到对应页面，
 * 而不是等整个任务结束才跳一次。为此后端要在运行中持续把改动文件暴露给 /runs。
 * 代价是每个间隔跑一次 `git status --porcelain`，在大仓库上并不便宜，
 * 所以间隔不能再往下压（低于 1.5s 会明显拖慢 Agent 自己的构建/写盘）。
 */
const FILE_POLL_INTERVAL = 2000;

/** 单次 git status 的兜底超时（毫秒）：git 卡住时必须强制结束，不能累积僵尸进程 */
const GIT_STATUS_TIMEOUT = 10000;

/**
 * 单次「内容指纹」批量计算的兜底超时（毫秒）
 *
 * 指纹只对 git status 已经报出来的文件算（正常就是几个），一次 `git hash-object --stdin-paths`
 * 就够；但只要它可能卡住，就必须有兜底，否则 2s 的轮询会越堆越多。
 */
const GIT_HASH_TIMEOUT = 10000;

/**
 * 单次最多给多少个文件算指纹（超过就放弃指纹，退回「只比状态位」）
 *
 * 轮询间隔 2s。正常开发时 git status 报出来的文件是个位数，批量 hash 一次只要几十毫秒；
 * 但如果工作区里有几百个未提交文件（大仓库、别人正在改），每 2s 把这些文件内容全部读一遍
 * 就太贵了。超过这个上限时宁可退回旧语义（只比状态位），也不拖慢 Agent 自己的构建/写盘。
 */
const MAX_FINGERPRINT_FILES = 300;

/**
 * 同步任务（如 AI 润色单个文档）的默认超时
 *
 * 润色要跑完一次完整的 Agent 循环（读文件 → 改写 → 落盘），实测比简短回复慢一个量级，
 * 3 分钟会经常被掐断（表现就是「润色失败」）。默认放到 8 分钟，可用 DSH_POLISH_TIMEOUT 覆盖；
 * 前端的等待时间必须比它更长，否则后端自己的错误信息传不回前端。
 */
const SYNC_TASK_TIMEOUT = 8 * 60 * 1000;

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
     * 本机 DSH 的 profile 列表（界面上「模式」下拉的数据源）
     *
     * 只有 headless 适合本控制台「跑一次就退出」的用法；
     * web / desktop 是常驻应用，列出来仅供了解。
     */
    listProfiles() {
        const home = process.env.DSH_HOME || path.join(process.env.USERPROFILE || process.env.HOME || '', '.dsh');
        let names: string[] = [];

        try {
            names = fs
                .readdirSync(path.join(home, 'profiles'), { withFileTypes: true })
                .filter((item) => item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules')
                .map((item) => item.name);
        } catch {
            names = [];
        }

        return {
            home,
            items: names.sort().map((name) => ({
                name,
                builtin: ['headless', 'web', 'desktop'].includes(name),
                /** 是否适合本控制台的一次性任务（目前只有 headless） */
                oneShot: name === DEFAULT_PROFILE,
            })),
        };
    }

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
     * 按 id 找一条执行记录（可选链安全）
     *
     * 前端拿 startBackgroundSyncTask 返回的 runId 轮询进度时用它。
     * 找不到时返回 null —— 调用方应把它当成「还没登记」，继续轮询而不是报错。
     */
    findRun(id: string): DevAgentRunRecord | null {
        const key = String(id || '').trim();
        if (!key) return null;
        return this.runs.find((item) => item.id === key) ?? null;
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

            const run = await this.runAgent(launcher, cwd, prompt, this.resolveReplyTimeout(), {
                profile: dto.profile,
                sessionId: dto.sessionId,
            });
            const after = await this.collectChangedFiles(cwd);
            // 与后台通道同一套对比：状态位或内容指纹变了都算改动（见 changedSince）
            const files = this.changedSince(before, after);

            const answer =
                (run.answer.length > REPLY_LIMIT ? `${run.answer.slice(0, REPLY_LIMIT)}…` : run.answer) ||
                (run.timedOut ? '（回复超时，请重试）' : '（没有拿到回复）');

            const result = {
                channel: 'reply' as const,
                answer,
                ok: run.exitCode === 0,
                exitCode: run.exitCode,
                duration: Date.now() - startedAt,
                files,
                sessionId: run.sessionId,
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
                sessionId: run.sessionId,
                events: run.events,
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
            sessionId: dto.sessionId || null,
            finishedAt: '',
        };

        // 先占位入历史，前端一提交就能在 /runs 里看到 running 状态
        this.running = true;
        this.pushRun(record);

        // 故意不 await：把控制权立刻交回前端
        void this.executeBackground(launcher, cwd, dto.prompt, record, startedAt, {
            profile: dto.profile,
            sessionId: dto.sessionId,
        });
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
        options: { profile?: string; sessionId?: string } = {},
    ) {
        // 运行期的改动文件轮询：任务开始就起，结束时（finally）一定清掉
        let fileTimer: NodeJS.Timeout | null = null;

        try {
            const before = await this.collectChangedFiles(cwd);
            // 基线本身写一次（此刻「本次改动」为空），让前端立刻拿到 filesUpdatedAt
            this.syncChangedFiles(record, before, before);
            fileTimer = this.startFilePolling(cwd, before, record);

            const run = await this.runAgent(launcher, cwd, prompt, this.resolveTimeout(), options);
            const after = await this.collectChangedFiles(cwd);

            // 最终对比是权威完整列表（增量轮询可能比它早一个间隔）
            this.syncChangedFiles(record, before, after);
            record.exitCode = run.exitCode;
            record.ok = run.exitCode === 0;
            record.duration = Date.now() - startedAt;
            record.output = run.answer;
            record.reasoningTail = this.tail(run.stderr, STDERR_LIMIT);
            record.sessionId = run.sessionId || record.sessionId || null;
            record.events = run.events;
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
            this.stopFilePolling(fileTimer);
            this.running = false;
        }
    }

    /**
     * 起一个轻量轮询，把「当前改动文件集合」增量写进 record.files
     *
     * 为什么不用 chokidar 之类的文件监听：这里要的是「改了哪些文件」这个
     * 与菜单页面对应的结论，而 git status 就是唯一权威来源（新增/删除/重命名
     * 都能一眼看出来）。间隔 2s（见 FILE_POLL_INTERVAL），开销可接受。
     *
     * @param baseline  任务开始时的 git status 结果，用作「哪些是这次改的」的基准
     * @param record    正在跑的那条历史记录（前端轮询读的就是它）
     */
    private startFilePolling(
        cwd: string,
        baseline: DevAgentChangedFile[],
        record: DevAgentRunRecord,
    ): NodeJS.Timeout {
        const timer = setInterval(() => {
            void this.collectChangedFiles(cwd).then((current) => {
                // 任务已经收了（或记录已被替换）就别再动它
                if (record.running === false) return;
                this.syncChangedFiles(record, baseline, current);
            });
        }, FILE_POLL_INTERVAL);

        // 计时器不参与事件循环的存活判定：即使异常路径漏了清理，进程也能正常退出
        timer.unref?.();

        return timer;
    }

    /** 停止运行期的改动文件轮询 */
    private stopFilePolling(timer: NodeJS.Timeout | null) {
        if (!timer) return;
        clearInterval(timer);
    }

    /**
     * 把「开始基线 → 当前状态」的差异写进 record.files
     *
     * 对比算法统一走 changedSince（状态位或内容指纹任一变化即算改动），
     * 结束时的权威对比与运行期轮询完全一致；filesUpdatedAt 每次刷新都会更新，
     * 前端据此判断新鲜度。
     *
     * @param baseline 任务开始时的 git status
     * @param after    当前 git status（不传 = 空，用于「基线即当前」的初始化）
     */
    private syncChangedFiles(
        record: DevAgentRunRecord,
        baseline: DevAgentChangedFile[],
        after?: DevAgentChangedFile[],
    ) {
        const current = after ?? [];

        record.files = this.changedSince(baseline, current);
        record.filesUpdatedAt = new Date().toISOString();
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
     * 后台跑一次会改动文件的一次性任务（「AI 润色」这类），**立即返回**
     *
     * 为什么改成异步：一次润色实测要 100 秒上下，同步接口会让前端长时间空白等待，
     * 用户以为「点了没反应」就会反复点，而并发锁又只允许一个任务 → 后续点击全部报错，
     * 表现就是「AI 润色无法使用」。改成先返回 runId，由前端轮询 /dev-agent/runs 看进度，
     * 既不会超时，也能把「已有一个任务正在执行」如实显示出来。
     *
     * 注意：这里刻意**不**复用 requireLauncher() 的并发检查 —— 那样「忙」会变成
     * 同步抛错，接口就无法返回 runId 了。并发占用放到后台任务里判定，
     * 让这次尝试以一条失败的运行记录呈现，前端照样能轮询到原因。
     *
     * @param prompt 任务描述
     * @param runId 由调用方生成，接口先把它返回给前端用于轮询
     * @param timeoutMs 超时
     */
    startBackgroundSyncTask(
        prompt: string,
        runId: string,
        timeoutMs: number = this.resolveSyncTimeout(),
        options: { profile?: string; sessionId?: string } = {},
    ): { started: boolean; runId: string; startedAt: string } {
        const startedAt = Date.now();
        const startedAtIso = new Date(startedAt).toISOString();

        // 先把记录放进历史，前端拿到 runId 立刻就能查到「运行中」
        const record: DevAgentRunRecord = {
            id: runId,
            channel: 'code',
            prompt,
            startedAt: startedAtIso,
            finishedAt: '',
            running: true,
            ok: false,
            exitCode: null,
            duration: 0,
            output: '',
            reasoningTail: '',
            files: [],
            events: [],
        };
        this.lastRun = record;
        this.pushRun(record);

        // 刻意不 await：立刻把 runId 交还给接口
        void this.runSyncTaskInto(record, prompt, timeoutMs, options, startedAt);

        return { started: true, runId, startedAt: startedAtIso };
    }

    /**
     * 同步跑一次会改动文件的一次性任务（「AI 润色」这类）
     *
     * 保留同步语义供内部/其它调用方使用；润色接口走 startBackgroundSyncTask。
     */
    async runSyncTask(
        prompt: string,
        timeoutMs: number = this.resolveSyncTimeout(),
        options: { profile?: string; sessionId?: string } = {},
    ): Promise<DevAgentRunResult> {
        const record: DevAgentRunRecord = {
            id: String(Date.now()),
            channel: 'code',
            prompt,
            startedAt: new Date().toISOString(),
            finishedAt: '',
            running: true,
            ok: false,
            exitCode: null,
            duration: 0,
            output: '',
            reasoningTail: '',
            files: [],
            events: [],
        };
        this.lastRun = record;
        this.pushRun(record);
        return this.runSyncTaskInto(record, prompt, timeoutMs, options, Date.now());
    }

    /**
     * 真正执行同步任务，并把结果写回给定的运行记录（前端轮询看到的就是它）
     */
    private async runSyncTaskInto(
        record: DevAgentRunRecord,
        prompt: string,
        timeoutMs: number,
        options: { profile?: string; sessionId?: string },
        startedAt: number,
    ): Promise<DevAgentRunResult> {
        // 启动器缺失 / 已有任务在跑：都写进这条记录，让前端轮询到原因，而不是静默失败
        let launcher: DshLauncher | null = null;
        let blocked: string | null = null;
        try {
            launcher = this.requireLauncher();
        } catch (error) {
            blocked = error?.message || '无法启动执行器';
        }

        if (!launcher) {
            const result: DevAgentRunResult = {
                ok: false,
                exitCode: null,
                duration: Date.now() - startedAt,
                output: '',
                reasoningTail: '',
                files: [],
                error: blocked || '无法启动执行器',
                finishedAt: new Date().toISOString(),
            };
            Object.assign(record, { ...result, running: false, events: [] });
            this.logger.warn(`开发模式-同步任务未能启动：${result.error}`);
            return result;
        }

        const cwd = this.resolveCwd();
        this.running = true;

        try {
            const before = await this.collectChangedFiles(cwd);
            const run = await this.runAgent(launcher, cwd, prompt, timeoutMs, options);
            const after = await this.collectChangedFiles(cwd);

            const result: DevAgentRunResult = {
                ok: run.exitCode === 0,
                exitCode: run.exitCode,
                duration: Date.now() - startedAt,
                output: run.answer,
                reasoningTail: this.tail(run.stderr, STDERR_LIMIT),
                // 与后台通道一致：状态位或内容指纹任一变化都算改动
                files: this.changedSince(before, after),
                sessionId: run.sessionId,
                finishedAt: new Date().toISOString(),
                error: run.timedOut ? '执行超时，已被强制结束' : run.errorText || undefined,
            };

            Object.assign(record, { ...result, running: false, events: run.events });

            this.logger.log(`开发模式-同步任务结束：用时=${result.duration}ms 改动文件=${result.files.length}`);
            return result;
        } catch (error) {
            const result: DevAgentRunResult = {
                ok: false,
                exitCode: null,
                duration: Date.now() - startedAt,
                output: '',
                reasoningTail: '',
                files: [],
                error: error?.message || '执行失败',
                finishedAt: new Date().toISOString(),
            };
            Object.assign(record, { ...result, running: false });
            this.logger.warn(`开发模式-同步任务异常：${result.error}`);
            return result;
        } finally {
            this.running = false;
        }
    }

    /**
     * 跑一次 Agent，并把 --json 事件流解析成轨迹
     */
    private async runAgent(
        launcher: DshLauncher,
        cwd: string,
        prompt: string,
        timeout: number,
        options: { profile?: string; sessionId?: string } = {},
    ) {
        const run = await this.spawnAgent(launcher, cwd, prompt, timeout, options);
        const { events, text, sessionId, errorText } = this.parseRunEvents(run.stdout);

        return {
            ...run,
            events,
            sessionId,
            errorText,
            // 最终答复优先取 final/text 事件，拿不到再退回 stdout 尾部
            answer: text || this.tail(run.stdout, STDOUT_LIMIT),
        };
    }

    /** 解析 DSH --json 的 NDJSON 事件流 */
    private parseRunEvents(stdout: string) {
        const events: DshRunEvent[] = [];
        let text = '';
        let sessionId: string | null = null;
        // DSH 的失败是用 error 事件报的，进程仍可能以 0 退出：
        // 单独留一份给调用方，才能把「为什么没改成」告诉用户
        let errorText = '';

        for (const line of String(stdout || '').split(/\r?\n/)) {
            const raw = line.trim();
            if (!raw.startsWith('{')) continue;

            let event: DshRunEvent;
            try {
                event = JSON.parse(raw);
            } catch {
                continue;
            }
            if (!event || typeof event !== 'object' || !event.type) continue;

            if (event.type === 'session' && event.sessionId) sessionId = String(event.sessionId);
            if (event.type === 'error' && typeof event.message === 'string') errorText = event.message;
            if ((event.type === 'final' || event.type === 'text') && typeof event.text === 'string') {
                text = event.text;
            }

            events.push(this.trimEvent(event));
        }

        return {
            events: events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events,
            text: text.trim(),
            sessionId,
            errorText,
        };
    }

    /** 事件只保留可展示的标量字段并截断长文本，避免响应体过大 */
    private trimEvent(event: DshRunEvent): DshRunEvent {
        const result: DshRunEvent = { type: String(event.type) };

        for (const [key, value] of Object.entries(event)) {
            if (key === 'type') continue;

            if (typeof value === 'string') {
                result[key] = value.length > EVENT_TEXT_LIMIT ? `${value.slice(0, EVENT_TEXT_LIMIT)}…` : value;
                continue;
            }
            if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
                result[key] = value;
            }
            // 对象/数组类型的事件字段先不传，轨迹面板用不到，也避免体积失控
        }

        return result;
    }

    /**
     * 以「Electron 可执行文件 + cli.js + 参数数组」的方式启动，不经过 shell
     */
    private spawnAgent(
        launcher: DshLauncher,
        cwd: string,
        prompt: string,
        timeout: number,
        options: { profile?: string; sessionId?: string } = {},
    ) {
        return new Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }>(
            (resolve, reject) => {
                const profile = String(options.profile || '').trim() || DEFAULT_PROFILE;
                // 顺序：启动器参数 → 应用参数（--session-id / --json）→ 任务文本
                const args = ['--expose-internals', launcher.cli, '--profile', profile];
                if (options.sessionId) args.push('--session-id', String(options.sessionId));
                args.push('--json', prompt);

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

    /**
     * 用 git status 列出这次任务改了哪些文件（含内容指纹）
     *
     * 两条关键参数：
     *   - `-uall`（= --untracked-files=all）：**未跟踪目录按文件逐个列出**。
     *     默认的 `-u normal` 对新建的整个页面目录只报一行 `?? ADMINCLIENT/src/pages/Xxx/`
     *     （带斜杠、没有文件名），前端拿不到「具体是哪个页面文件」，新建页面时不跟随跳转；
     *     加了 `-uall` 才会分别报出目录里的 index.vue / index.scss 等具体文件。
     *   - `-z`：用 NUL 分隔、且**不做引号转义**（绕开 core.quotepath），
     *     路径里有空格、中文、引号都不会被截断或转义错位。
     *
     * 解析出来的每一项再补一个内容指纹（见 DevAgentChangedFile.fingerprint），
     * 让「状态位没变但内容被整体重写」也能被察觉。
     */
    private async collectChangedFiles(cwd: string): Promise<DevAgentChangedFile[]> {
        const files = await this.readGitStatus(cwd);
        return this.attachFingerprints(cwd, files);
    }

    /**
     * 跑一次 `git status --porcelain -z -uall` 并解析
     *
     * -z 的输出形态（NUL 分隔，不带换行）：
     *   `XY <path>\0`，重命名/复制是 `XY <新路径>\0<原路径>\0`
     *   —— 原路径那一段**没有状态头**，必须整段跳过，否则会被当成一个畸形的改动文件。
     */
    private readGitStatus(cwd: string): Promise<DevAgentChangedFile[]> {
        return new Promise((resolve) => {
            const child = spawn('git', ['status', '--porcelain', '-z', '-uall'], {
                cwd,
                windowsHide: true,
            });

            let output = '';
            let settled = false;
            let timer: NodeJS.Timeout | null = null;

            const finish = () => {
                if (settled) return;
                settled = true;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                resolve(this.parseStatusOutput(output));
            };

            // 运行期每 2s 扫一次，git 若卡住必须兜底结束，否则轮询会越堆越多
            timer = setTimeout(() => {
                this.logger.warn(`git status 超时（${GIT_STATUS_TIMEOUT}ms），已强制结束`);
                this.killTree(child.pid);
                finish();
            }, GIT_STATUS_TIMEOUT);
            timer.unref?.();

            child.stdout?.on('data', (data) => {
                output += String(data);
            });
            child.on('error', () => finish());
            child.on('exit', () => finish());
        });
    }

    /** 解析 `git status --porcelain -z` 的输出（NUL 分隔，重命名占两段） */
    private parseStatusOutput(output: string): DevAgentChangedFile[] {
        const files: DevAgentChangedFile[] = [];
        const tokens = String(output || '').split('\0');

        for (let index = 0; index < tokens.length; index += 1) {
            const token = tokens[index];
            if (!token) continue;

            const status = token.slice(0, 2).trim();
            const filePath = token.slice(3).trim();
            if (!status || !filePath) continue;

            files.push({ status, path: filePath });

            // 重命名（R）/ 复制（C）：紧跟的一段是「原路径」，没有状态头，跳过它
            if (/^[RC]/.test(status)) index += 1;
        }

        return files;
    }

    /**
     * 给 git status 报出来的每个文件算内容指纹
     *
     * 实现取舍：
     *   - 用 `git hash-object --stdin-paths` **一次进程算完所有文件**（不是每个文件起一个 git），
     *     且不带 `-w`（不写对象库，纯粹算哈希，不会污染仓库）；
     *   - 只算 git status 已报告的文件（正常只有几个），不会对全仓几百个文件做哈希；
     *     文件数超过 MAX_FINGERPRINT_FILES 时直接放弃指纹（退回旧语义），保住 2s 轮询的开销；
     *   - 算不出来的（删除、目录、权限问题）退化成 `stat:<mtime>:<size>`，
     *     再不行用状态位兜底 —— 有值就行，关键是同一路径两次采样可比较。
     */
    private async attachFingerprints(
        cwd: string,
        files: DevAgentChangedFile[],
    ): Promise<DevAgentChangedFile[]> {
        if (!files.length) return files;

        if (files.length > MAX_FINGERPRINT_FILES) {
            this.logger.warn(
                `本次 git status 报告了 ${files.length} 个文件（上限 ${MAX_FINGERPRINT_FILES}），跳过内容指纹，只比状态位`,
            );
            return files;
        }

        // 不存在的文件（已删除）不必也不能算哈希，直接用 stat 兜底
        const existing = files.filter((item) => {
            try {
                return fs.statSync(path.resolve(cwd, item.path)).isFile();
            } catch {
                return false;
            }
        });

        const hashes = existing.length
            ? await this.hashObjects(
                  cwd,
                  existing.map((item) => item.path),
              )
            : new Map<string, string>();

        return files.map((item) => ({
            ...item,
            fingerprint: hashes.get(item.path) ?? this.statFingerprint(cwd, item.path, item.status),
        }));
    }

    /** 一次进程算出多个文件的内容哈希（key = git status 给的仓库相对路径） */
    private hashObjects(cwd: string, paths: string[]): Promise<Map<string, string>> {
        return new Promise((resolve) => {
            const result = new Map<string, string>();
            if (!paths.length) {
                resolve(result);
                return;
            }

            const child = spawn('git', ['hash-object', '--stdin-paths'], {
                cwd,
                windowsHide: true,
            });

            let output = '';
            let settled = false;
            let timer: NodeJS.Timeout | null = null;

            const finish = () => {
                if (settled) return;
                settled = true;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }

                // 输出按输入顺序一行一个哈希；行数与文件数对不上时只认对得上的前缀
                const lines = output.split(/\r?\n/).filter((line) => line.trim());
                lines.forEach((line, index) => {
                    const name = paths[index];
                    const hash = line.trim();
                    if (name && /^[0-9a-f]{7,}$/i.test(hash)) result.set(name, hash);
                });
                resolve(result);
            };

            timer = setTimeout(() => {
                this.logger.warn(`git hash-object 超时（${GIT_HASH_TIMEOUT}ms），已强制结束`);
                this.killTree(child.pid);
                finish();
            }, GIT_HASH_TIMEOUT);
            timer.unref?.();

            child.stdout?.on('data', (data) => {
                output += String(data);
            });
            child.on('error', () => finish());
            child.on('exit', () => finish());

            // 路径按行喂给 git（git status 给的是 / 分隔的仓库相对路径，Windows 下同样可用）
            child.stdin?.on('error', () => {
                /* 进程可能已退出，忽略写入失败，等 exit 兜底 */
            });
            child.stdin?.end(paths.join('\n') + '\n');
        });
    }

    /** 内容哈希算不出来时的兜底指纹：`stat:<mtimeMs>:<size>`，读不到就用状态位 */
    private statFingerprint(cwd: string, filePath: string, status: string): string {
        try {
            const stat = fs.statSync(path.resolve(cwd, filePath));
            return `stat:${Math.round(stat.mtimeMs)}:${stat.size}`;
        } catch {
            return `status:${status}`;
        }
    }

    /**
     * 「开始基线 → 当前」的差异：**状态位或内容指纹任一变化**都算本次改动
     *
     * 这就是场景 B 的修复点：任务开始前就已经是 M 的文件，被 Agent 整体重写后状态位仍是 M，
     * 只比状态位会漏掉它（实测 324 行的改动被当成「没变化」）；比指纹就能抓到。
     * 指纹缺失（老调用方 / 超限退化）时退回原来的状态位比较，不改变既有语义。
     */
    private changedSince(
        baseline: DevAgentChangedFile[],
        current: DevAgentChangedFile[],
    ): DevAgentChangedFile[] {
        const before = new Map(baseline.map((item) => [item.path, item]));
        return current.filter((item) => {
            const prev = before.get(item.path);
            // 基线里没有 → 本次新出现的改动
            if (!prev) return true;
            // 状态位变了（M→A、??→M、新增/删除……）
            if (prev.status !== item.status) return true;
            // 状态位没变：看内容指纹
            if (prev.fingerprint && item.fingerprint) return prev.fingerprint !== item.fingerprint;
            return false;
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

    /** 同步任务（AI 润色）的超时（可用 DSH_POLISH_TIMEOUT 覆盖） */
    private resolveSyncTimeout(): number {
        const value = Number(process.env.DSH_POLISH_TIMEOUT);
        if (!Number.isFinite(value) || value <= 0) return SYNC_TASK_TIMEOUT;
        return Math.min(Math.floor(value), 30 * 60 * 1000);
    }

    /** 只保留末尾若干字符，避免长文本塞满页面 */
    private tail(text: string, limit: number): string {
        const value = String(text || '').trim();
        if (value.length <= limit) return value;
        return `…${value.slice(value.length - limit)}`;
    }
}

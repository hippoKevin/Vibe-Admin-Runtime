import requestApi from "@/utils/request/request";

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
    /** Agent 的最终答复（后端已截断） */
    output: string;
    /** 推理过程尾部 */
    reasoningTail: string;
    files: DevAgentChangedFile[];
    finishedAt: string;
    error?: string;
}

/** 开发模式状态（dsh 是否就绪） */
export interface DevAgentStatus {
    ready: boolean;
    cliPath: string | null;
    launcher: string | null;
    cwd: string;
    timeout: number;
    running: boolean;
    lastRun: DevAgentRunResult | null;
    hint: string | null;
}

/** 获取开发模式状态（dsh 是否就绪、最近一次执行结果） */
export function getDevAgentStatus() {
    return requestApi({
        url: '/hippoadmin/dev-agent/status',
        method: 'get'
    });
}

/** 提交一次代码生成任务（prompt 为语音转写或手动输入的描述） */
export function generateCode(data: { prompt: string }) {
    return requestApi({
        url: '/hippoadmin/dev-agent/generate',
        method: 'post',
        data
    });
}

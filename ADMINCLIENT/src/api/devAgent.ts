import requestApi from '@/utils/request/request'

/**
 * 开发模式（Agent 改代码）接口
 *
 * 全部走项目统一的 requestApi（内部 /proxy 前缀 → 后端 /hippoadmin），
 * 响应拆包规则与原来的独立控制台页面保持一致（code === 2000 取 data）。
 */

/** 一次执行的改动文件 */
export interface DevAgentChangedFile {
  status: string
  path: string
}

/** 通道：reply = 简短回复（TTS 播报）/ code = 后台执行代码 */
export type DevAgentChannel = 'reply' | 'code'

/**
 * 一次执行的结果
 *
 * 历史记录（/runs）里简短回复通道会把答复放在 output 里，
 * 这里保留可选的 answer 以兼容直接拿回复结果使用的场景。
 */
export interface DevAgentRunResult {
  ok: boolean
  exitCode: number | null
  duration: number
  output: string
  reasoningTail: string
  files: DevAgentChangedFile[]
  finishedAt: string
  error?: string
  /** 简短回复通道的纯文本答复（就是给 TTS 念的内容） */
  answer?: string
}

/** 一条执行历史（面板用） */
export interface DevAgentRunRecord extends DevAgentRunResult {
  id: string
  prompt: string
  startedAt: string
  /** 通道：reply 简短回复 / code 后台执行代码 */
  channel?: DevAgentChannel
  /** 是否仍在后台运行中 */
  running?: boolean
}

/** reply 通道（同步返回）的结果 */
export interface DevAgentReplyResult {
  channel: 'reply'
  answer: string
  ok: boolean
  exitCode: number | null
  duration: number
  files: DevAgentChangedFile[]
  finishedAt: string
}

/** code 通道（立刻返回）的受理凭据 */
export interface DevAgentCodeAccepted {
  channel: 'code'
  runId: string
  started: boolean
  running: boolean
  startedAt: string
}

/** /dev-agent/status 返回 */
export interface DevAgentStatus {
  ready: boolean
  cliPath: string | null
  launcher: string | null
  cwd: string
  timeout: number
  running: boolean
  lastRun: DevAgentRunResult | null
  hint: string | null
}

/** /dev-agent/runs 返回 */
export interface DevAgentRuns {
  running: boolean
  timeout: number
  cwd: string
  items: DevAgentRunRecord[]
}

/** 任务最长等待时间：要覆盖后端 5 分钟的 Agent 超时（见 dev-agent.service.ts） */
const GENERATE_TIMEOUT = 10 * 60 * 1000

/** 简短回复通道的等待时间：后端 90s 超时，这里留一点余量 */
const REPLY_TIMEOUT = 2 * 60 * 1000

/**
 * 拆包：requestApi 返回的是后端统一响应体 { code, msg, data }，
 * 判定规则与原来独立控制台页面一致（code === 2000 才算成功）。
 */
function unwrap<T>(res: any): T {
  if (Number(res?.code) !== 2000) {
    throw new Error(res?.msg || res?.message || '请求失败')
  }
  return (res?.data ?? null) as T
}

/** 状态：dsh 是否就绪、最近一次执行结果 */
export async function getDevAgentStatus(): Promise<DevAgentStatus> {
  return unwrap<DevAgentStatus>(await requestApi({ url: '/hippoadmin/dev-agent/status', method: 'get' }))
}

/** 执行历史：控制台「执行过程」面板用 */
export async function getDevAgentRuns(): Promise<DevAgentRuns> {
  return unwrap<DevAgentRuns>(await requestApi({ url: '/hippoadmin/dev-agent/runs', method: 'get' }))
}

/**
 * 执行一次生成任务
 *
 * 两个通道共用同一个接口，靠 body.channel 分流：
 * - reply：同步阻塞（后端最长约 90s），返回一两句纯文本答复，前端用 TTS 念出来；
 * - code：立刻返回 runId（毫秒级），后端在后台跑，前端轮询 /runs 看进度。
 */
export async function generateByDevAgent(
  prompt: string,
  channel: DevAgentChannel = 'reply',
): Promise<DevAgentReplyResult | DevAgentCodeAccepted> {
  return unwrap<DevAgentReplyResult | DevAgentCodeAccepted>(
    await requestApi({
      url: '/hippoadmin/dev-agent/generate',
      method: 'post',
      data: { prompt, channel },
      timeout: channel === 'reply' ? REPLY_TIMEOUT : GENERATE_TIMEOUT,
    }),
  )
}

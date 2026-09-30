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

/** 一次执行的结果 */
export interface DevAgentRunResult {
  ok: boolean
  exitCode: number | null
  duration: number
  output: string
  reasoningTail: string
  files: DevAgentChangedFile[]
  finishedAt: string
  error?: string
}

/** 一条执行历史（面板用） */
export interface DevAgentRunRecord extends DevAgentRunResult {
  id: string
  prompt: string
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
 * 注意：这个接口是「同步阻塞」的 —— 后端要等 Agent 跑完才返回，
 * 可能长达数分钟，所以单独放大 axios 超时（默认 8s 会被误判为失败）。
 */
export async function generateByDevAgent(prompt: string): Promise<DevAgentRunResult> {
  return unwrap<DevAgentRunResult>(
    await requestApi({
      url: '/hippoadmin/dev-agent/generate',
      method: 'post',
      data: { prompt },
      timeout: GENERATE_TIMEOUT,
    }),
  )
}

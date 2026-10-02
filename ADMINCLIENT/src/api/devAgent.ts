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
 * DSH 运行事件（一行一条 NDJSON，字段随事件类型变化）
 *
 * 故意保留索引签名：轨迹面板按「通用渲染」处理，将来出现
 * 工具类事件或子智能体事件时不需要改前端就能显示出来。
 */
export interface DshRunEvent {
  type: string
  phase?: string
  turn?: number
  step?: number
  text?: string
  name?: string
  tool?: string
  status?: string
  sessionId?: string
  [key: string]: any
}

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
  /** DSH 会话 id：同一条会话的多次运行归到同一段对话里 */
  sessionId?: string | null
  /** 运行轨迹（DSH --json 事件流） */
  events?: DshRunEvent[]
  /**
   * files 最近一次刷新的时间
   *
   * 后端在任务运行期间每 2s 用 git status 增量对比一次改动文件，
   * 前端据此判断「运行中的这份文件列表」有多新鲜。
   */
  filesUpdatedAt?: string
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
  sessionId?: string | null
  events?: DshRunEvent[]
}

/** code 通道（立刻返回）的受理凭据 */
export interface DevAgentCodeAccepted {
  channel: 'code'
  runId: string
  started: boolean
  running: boolean
  sessionId?: string | null
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

/** /dev-agent/profiles 返回里的一个 DSH profile（模式） */
export interface DevAgentProfile {
  name: string
  /** 是否是当前生效的那个 profile */
  active?: boolean
  /** 是否是 DSH 自带的 profile */
  builtin?: boolean
}

/** 提交生成任务时可选的上下文 */
export interface DevAgentGenerateOptions {
  /** DSH profile（「模式」下拉框），不传由后端取默认值 */
  profile?: string
  /** DSH 会话 id：带上就是接着这条会话继续追问 */
  sessionId?: string
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
 * DSH profile 列表（面板上的「模式」下拉框）
 *
 * 后端尚未上线该接口时返回空数组：面板保留下拉框并允许手工输入 profile 名，
 * 调用方不需要为了一个可选能力去处理异常分支。
 */
export async function getDevAgentProfiles(): Promise<DevAgentProfile[]> {
  try {
    const data = unwrap<{ items?: DevAgentProfile[] }>(
      await requestApi({ url: '/hippoadmin/dev-agent/profiles', method: 'get' }),
    )
    return Array.isArray(data?.items) ? data.items : []
  } catch {
    return []
  }
}

/**
 * 执行一次生成任务
 *
 * 两个通道共用同一个接口，靠 body.channel 分流：
 * - reply：同步阻塞（后端最长约 90s），返回一两句纯文本答复，前端用 TTS 念出来；
 * - code：立刻返回 runId（毫秒级），后端在后台跑，前端轮询 /runs 看进度。
 *
 * @param prompt  任务文本
 * @param channel 通道
 * @param options DSH profile（模式）与 sessionId（追问同一条会话）
 */
export async function generateByDevAgent(
  prompt: string,
  channel: DevAgentChannel = 'reply',
  options: DevAgentGenerateOptions = {},
): Promise<DevAgentReplyResult | DevAgentCodeAccepted> {
  const profile = String(options.profile || '').trim()
  const sessionId = String(options.sessionId || '').trim()

  return unwrap<DevAgentReplyResult | DevAgentCodeAccepted>(
    await requestApi({
      url: '/hippoadmin/dev-agent/generate',
      method: 'post',
      data: {
        prompt,
        channel,
        ...(profile ? { profile } : {}),
        ...(sessionId ? { sessionId } : {}),
      },
      timeout: channel === 'reply' ? REPLY_TIMEOUT : GENERATE_TIMEOUT,
    }),
  )
}

/**
 * 开发模式的语音合成（TTS）
 *
 * 后端把本机的 IndexTTS（Gradio WebUI）桥接成下面两个接口；
 * 不可达时状态接口仍返回 200，只是 ready=false 并带一句中文提示，
 * 前端据此回退到浏览器内置的 speechSynthesis。
 */

/** IndexTTS 状态：是否可达 + 参考音色清单 */
export interface TtsStatus {
  reachable: boolean
  baseUrl: string
  home: string
  items: string[]
  defaultVoice: string | null
  /** 可达且有参考音色才为 true */
  ready: boolean
  /** 不可用时的中文提示（可直接展示给用户） */
  hint: string | null
}

/** 语音合成结果 */
export interface TtsSynthResult {
  ok: boolean
  file: string
  /** 直接交给 new Audio() 的相对地址 */
  audioUrl: string
  voice: string
  lang: string
  /** 本次请求耗时（毫秒） */
  duration: number
  /** 音频本身时长（毫秒） */
  audioMs: number
  size: number
  text: string
}

/** 合成超时：首次调用要加载模型，给足 3 分钟（与后端一致） */
const TTS_TIMEOUT = 3 * 60 * 1000

/** 探测 IndexTTS 状态（永远成功，不可达也是一种状态） */
export async function getTtsStatus(): Promise<TtsStatus | null> {
  try {
    return unwrap<TtsStatus>(
      await requestApi({ url: '/hippoadmin/dev-agent/tts/status', method: 'get', timeout: 15000 }),
    )
  } catch {
    return null
  }
}

/** 合成语音（text 上限 500 字；失败会被抛出，由调用方回退到浏览器播报） */
export async function synthesizeSpeech(data: {
  text: string
  voice?: string
  lang?: string
}): Promise<TtsSynthResult> {
  return unwrap<TtsSynthResult>(
    await requestApi({
      url: '/hippoadmin/dev-agent/tts',
      method: 'post',
      data,
      timeout: TTS_TIMEOUT,
    }),
  )
}

/**
 * 把合成音频取成 blob URL，供 <audio> 播放
 *
 * 为什么不直接把 audioUrl 交给 new Audio()：/tts/audio 需要 JWT 鉴权，
 * 而 <audio src> 这类媒体加载由浏览器直接发请求、不会带 Authorization 头，
 * 结果是 MEDIA_ERR_SRC_NOT_SUPPORTED（error code 4）静默失败。
 * 这里用带鉴权的 fetch 把音频读成 Blob 再转 blob: URL —— 鉴权不放松。
 *
 * 调用方负责在用完后 URL.revokeObjectURL。
 */
export async function fetchSpeechAudioBlobUrl(audioUrl: string): Promise<string> {
  const token = localStorage.getItem('token') || ''
  // baseURL 是 /proxy，这里与其它请求走同一条代理链路
  const res = await fetch(`/proxy${audioUrl}`, {
    headers: token ? { Authorization: token } : {},
  })
  if (!res.ok) throw new Error(`取回合成音频失败（HTTP ${res.status}）`)

  const blob = await res.blob()
  if (!blob.size) throw new Error('合成音频为空')
  return URL.createObjectURL(blob)
}

import requestApi from "@/utils/request/request";

/**
 * 「智能管理 → TTS 管理」接口
 *
 * 全部挂在后端 /dev-agent/tts 下（同一个 TtsController）：
 * 配置读写、音色清单、真机试听、IndexTTS 可达性。
 */

/** 试听：合成要加载模型，首次可能要几十秒，给足 3 分钟（与后端一致） */
const PREVIEW_TIMEOUT = 3 * 60 * 1000

/** 状态探测：后端只做一次 2.5 秒的探针，这里给 15 秒容错 */
const STATUS_TIMEOUT = 15 * 1000

/** 声音参数值：数值滑块 / 开关 / 情感描述文本 */
export type TtsParamValue = number | boolean | string

/** 全部声音参数（键名与后端 PARAM_DEFS 一一对应） */
export interface TtsParams {
  emoWeight: number
  vec1: number
  vec2: number
  vec3: number
  vec4: number
  vec5: number
  vec6: number
  vec7: number
  vec8: number
  emoText: string
  emoRandom: boolean
  maxTextTokensPerSegment: number
  durationFactor: number
  doSample: boolean
  topP: number
  topK: number
  temperature: number
  lengthPenalty: number
  numBeams: number
  repetitionPenalty: number
  maxMelTokens: number
}

/** 后端返回的配置 */
export interface TtsConfig {
  /** 当前选中的参考音色文件名 */
  voice: string | null
  /** 语言：ZH / EN / JA / AR / ES */
  lang: string
  params: TtsParams
  /** 最后保存时间（ISO 字符串，未保存过为 null） */
  updatedAt: string | null
}

/** 一个可用音色 */
export interface TtsVoiceItem {
  /** 文件名，如 voice_01.wav */
  name: string
  /** 文件大小（字节） */
  size: number
  /** 是否当前选中 */
  selected: boolean
}

/** 音色列表返回 */
export interface TtsVoiceList {
  items: TtsVoiceItem[]
  current: string | null
  dir: string
}

/** IndexTTS 状态 */
export interface TtsStatus {
  reachable: boolean
  baseUrl: string
  home: string
  /** 参考音色文件名清单 */
  items: string[]
  defaultVoice: string | null
  ready: boolean
  config: TtsConfig
  /** 配置文件落盘位置 */
  configFile: string
  /** 参考音色目录 */
  voicesDir: string
  /** 后端认得的声音参数键名 */
  paramKeys: string[]
  /** 不可达 / 没有音色时的人话提示 */
  hint: string | null
}

/** 试听结果 */
export interface TtsPreviewResult {
  ok: boolean
  /** 指向 /hippoadmin/dev-agent/tts/audio?file=... */
  audioUrl: string
  /** 合成耗时（毫秒） */
  ms: number
  /** 音频字节数 */
  bytes: number
  /** 音频本身时长（毫秒） */
  audioMs: number
  voice: string
  lang: string
  text: string
}

/** 读取 TTS 配置（文件不存在时后端返回全默认值） */
export function getTtsConfig() {
  return requestApi({
    url: '/hippoadmin/dev-agent/tts/config',
    method: 'get'
  });
}

/** 保存 TTS 配置（部分更新：只提交改动过的字段也可以） */
export function saveTtsConfig(data: { voice?: string; lang?: string; params?: Partial<TtsParams> }) {
  return requestApi({
    url: '/hippoadmin/dev-agent/tts/config',
    method: 'post',
    data
  });
}

/** 可用音色列表（ADMINTTS/examples 下的 *.wav） */
export function getTtsVoices() {
  return requestApi({
    url: '/hippoadmin/dev-agent/tts/voices',
    method: 'get'
  });
}

/** IndexTTS 状态（永远成功，不可达也是一种状态） */
export function getTtsStatus() {
  return requestApi({
    url: '/hippoadmin/dev-agent/tts/status',
    method: 'get',
    timeout: STATUS_TIMEOUT
  });
}

/**
 * 试听：让后端用当前（或传入的）配置真合成一段短音频
 *
 * 返回里只有相对地址，播放要用 fetchTtsAudioBlobUrl 换成 blob: —— 见下面的说明。
 */
export function previewTts(data: {
  text?: string
  voice?: string
  lang?: string
  params?: Partial<TtsParams>
}) {
  return requestApi({
    url: '/hippoadmin/dev-agent/tts/preview',
    method: 'post',
    data,
    timeout: PREVIEW_TIMEOUT
  });
}

/**
 * 把合成音频取成 blob URL，供 <audio> 播放
 *
 * 为什么不直接把 audioUrl 交给 <audio src>：/dev-agent/tts/audio 需要 JWT 鉴权，
 * 而媒体加载由浏览器直接发请求、不会带 Authorization 头，结果是
 * MEDIA_ERR_SRC_NOT_SUPPORTED（error code 4）静默失败。
 * 这里用带 token 的 fetch 把音频读成 Blob 再转 blob: URL —— 鉴权不放松。
 *
 * 调用方负责在用完后 URL.revokeObjectURL。
 */
export async function fetchTtsAudioBlobUrl(audioUrl: string): Promise<string> {
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

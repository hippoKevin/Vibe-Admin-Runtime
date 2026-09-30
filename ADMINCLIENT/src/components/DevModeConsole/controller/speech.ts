/**
 * 开发模式 · 语音播报（TTS）
 *
 * 「快速回复」通道的答复是用来说、用来听的：拿到一两句纯文本后直接调
 * window.speechSynthesis 念出来，形成「说一句 → 听回答」的免手动闭环。
 *
 * 三条硬约束：
 *   1) 浏览器不支持 speechSynthesis 时静默降级 —— 只显示文字，绝不抛错；
 *   2) 每次 speak 之前先 cancel，避免两段语音叠在一起念；
 *   3) 组件卸载 / 退出开发模式 / 再次发送前都要 cancel，声音不能留在后台。
 */

/** 播报语速（1 = 正常语速） */
const SPEAK_RATE = 1.02
/** 播报音调（1 = 正常） */
const SPEAK_PITCH = 1
/** 播报音量（1 = 最大） */
const SPEAK_VOLUME = 1

interface SpeechHooks {
  /** 是否允许播报（静音开关 + 组件是否还活着，每次 speak 都重新问一次） */
  canSpeak: () => boolean
  /** 播报开始 / 结束（界面上的「正在播报」提示） */
  onStart: () => void
  onEnd: () => void
}

export class SpeechController {
  private hooks: SpeechHooks
  private synthesis: SpeechSynthesis | null
  private utterance: SpeechSynthesisUtterance | null = null
  /** 当前应用语言（zh-CN / en-US），跟随 i18n 切换 */
  private lang: string

  constructor(hooks: SpeechHooks, lang: string) {
    this.hooks = hooks
    this.lang = lang
    this.synthesis = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  }

  /** 运行环境是否支持语音播报（不支持时调用方只在结果卡显示文字） */
  get supported(): boolean {
    return !!this.synthesis
  }

  /** 跟随应用语言切换（zh-CN / en-US） */
  setLang(lang: string) {
    this.lang = lang || 'zh-CN'
  }

  /** 念一段文字（空文本、静音、不支持都直接忽略） */
  speak(text: string) {
    const content = String(text || '').trim()
    if (!content) return
    if (!this.synthesis || !this.hooks.canSpeak()) return

    const Ctor = (window as any).SpeechSynthesisUtterance
    if (typeof Ctor !== 'function') return

    // 上一次还在念就直接掐掉：不允许两段语音叠着念
    this.cancel()

    let utterance: SpeechSynthesisUtterance
    try {
      utterance = new Ctor(content)
    } catch {
      return
    }

    utterance.lang = this.lang
    utterance.rate = SPEAK_RATE
    utterance.pitch = SPEAK_PITCH
    utterance.volume = SPEAK_VOLUME
    utterance.onend = () => {
      this.utterance = null
      this.hooks.onEnd()
    }
    // 出错（没有可用语音、被系统打断）只结束提示，不往外抛
    utterance.onerror = () => {
      this.utterance = null
      this.hooks.onEnd()
    }

    this.utterance = utterance
    try {
      this.synthesis.speak(utterance)
    } catch {
      // 播报失败不影响文字结果：解掉回调、复位状态即可
      utterance.onend = null
      utterance.onerror = null
      this.utterance = null
      this.hooks.onEnd()
      return
    }
    this.hooks.onStart()
  }

  /** 立刻停止播报（静音、重新发送、切换通道、卸载都用它） */
  cancel() {
    if (!this.synthesis) return
    try {
      this.synthesis.cancel()
    } catch {
      /* 忽略：部分实现对 cancel 会抛错 */
    }
    this.utterance = null
    this.hooks.onEnd()
  }

  /** 卸载：解掉回调，避免异步 onend 回调到已销毁的组件上 */
  dispose() {
    if (this.synthesis) {
      try {
        this.synthesis.cancel()
      } catch {
        /* 忽略 */
      }
    }
    if (this.utterance) {
      this.utterance.onend = null
      this.utterance.onerror = null
    }
    this.utterance = null
    this.synthesis = null
  }
}

/**
 * 开发模式 · 语音播报（TTS）
 *
 * 「快速回复」通道的答复是用来说、用来听的：拿到一两句纯文本后直接念出来，
 * 形成「说一句 → 听回答」的免手动闭环。
 *
 * 两个引擎，优先 IndexTTS：
 *   1) IndexTTS（后端桥接的本机语音合成服务）—— 音色自然，优先用；
 *   2) 浏览器内置 speechSynthesis —— IndexTTS 不可达 / 合成失败时自动回退。
 * 无论走哪个引擎，下面的三条硬约束都成立：
 *   1) 引擎不可用时静默降级 —— 只显示文字，绝不抛错；
 *   2) 每次播报之前先停掉上一段（音频与语音合成一起停），不允许两段叠着念；
 *   3) 组件卸载 / 退出开发模式 / 再次发送前都要停，声音不能留在后台。
 */

/** 播报语速（1 = 正常语速） */
const SPEAK_RATE = 1.02
/** 播报音调（1 = 正常） */
const SPEAK_PITCH = 1
/** 播报音量（1 = 最大） */
const SPEAK_VOLUME = 1

/** 实际使用的引擎 */
export type SpeechEngine = 'indextts' | 'browser' | 'none'

interface SpeechHooks {
  /** 是否允许播报（静音开关 + 组件是否还活着，每次 speak 都重新问一次） */
  canSpeak: () => boolean
  /** 播报开始 / 结束（界面上的「正在播报」提示） */
  onStart: () => void
  onEnd: () => void
  /**
   * 调后端 IndexTTS 合成，返回可直接播放的地址；
   * 未配置（没传）或抛错都视为「该引擎不可用」，自动回退浏览器播报。
   */
  synthesize?: (text: string) => Promise<string | null>
}

export class SpeechController {
  private hooks: SpeechHooks
  private synthesis: SpeechSynthesis | null
  private utterance: SpeechSynthesisUtterance | null = null
  /** IndexTTS 播放中的音频（与 utterance 互斥，同一时刻只响一个） */
  private audio: HTMLAudioElement | null = null
  /** 当前应用语言（zh-CN / en-US），跟随 i18n 切换 */
  private lang: string
  /** 正在合成 / 播放的这次请求序号：用来丢弃过期请求的回调 */
  private token = 0
  /** 最近一次实际使用的引擎 */
  private engine: SpeechEngine = 'none'

  constructor(hooks: SpeechHooks, lang: string) {
    this.hooks = hooks
    this.lang = lang
    this.synthesis = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  }

  /** 运行环境是否支持语音播报（不支持时调用方只在结果卡显示文字） */
  get supported(): boolean {
    return !!this.synthesis || !!this.hooks.synthesize
  }

  /** 最近一次实际使用的引擎（界面上的状态行） */
  get lastEngine(): SpeechEngine {
    return this.engine
  }

  /** 跟随应用语言切换（zh-CN / en-US） */
  setLang(lang: string) {
    this.lang = lang || 'zh-CN'
  }

  /**
   * 念一段文字（空文本、静音、两个引擎都不可用都直接忽略）
   *
   * 先停掉上一段，再优先走 IndexTTS；合成失败或没配就回退浏览器播报。
   */
  async speak(text: string) {
    const content = String(text || '').trim()
    if (!content) return
    if (!this.hooks.canSpeak()) return

    // 不允许两段语音叠着念：新的一段开口前先把上一段掐掉
    this.cancel()

    const mine = ++this.token
    if (this.hooks.synthesize) {
      try {
        const url = await this.hooks.synthesize(content)
        // 合成期间用户可能已经静音 / 又发了新消息 / 卸载了组件，过期的结果直接丢掉
        if (url && mine === this.token && this.hooks.canSpeak()) {
          const played = await this.playUrl(url, mine)
          if (played) {
            this.engine = 'indextts'
            return
          }
        } else if (url) {
          return
        }
      } catch {
        // IndexTTS 不可达 / 超时 / 合成报错 —— 回退浏览器播报，不打断用户
      }
    }

    if (mine !== this.token || !this.hooks.canSpeak()) return
    this.engine = this.synthesis ? 'browser' : 'none'
    this.speakByBrowser(content)
  }

  /**
   * 用 IndexTTS 返回的地址播放
   *
   * @returns 是否真的开始播放（false 表示播放失败，调用方应回退浏览器播报）
   */
  private playUrl(url: string, mine: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let audio: HTMLAudioElement
      try {
        audio = new Audio(url)
      } catch {
        resolve(false)
        return
      }

      let settled = false
      const done = (ok: boolean) => {
        if (settled) return
        settled = true
        if (!ok) {
          this.audio = null
          this.hooks.onEnd()
        }
        resolve(ok)
      }

      audio.onplay = () => {
        if (mine !== this.token) return
        this.hooks.onStart()
      }
      audio.onended = () => {
        if (this.audio === audio) this.audio = null
        this.hooks.onEnd()
        done(true)
      }
      // 播放失败（格式不支持、被自动播放策略拦下、地址失效）→ 让调用方回退
      audio.onerror = () => {
        if (this.audio === audio) this.audio = null
        done(false)
      }

      this.audio = audio
      audio.play().then(
        () => {
          // 播放真正开始后 resolve，避免「静默失败却以为成功了」
          done(true)
        },
        () => {
          done(false)
        }
      )
    })
  }

  /** 浏览器内置播报（原有实现，作为回退） */
  private speakByBrowser(content: string) {
    if (!this.synthesis) return

    const Ctor = (window as any).SpeechSynthesisUtterance
    if (typeof Ctor !== 'function') return

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

  /** 立刻停止播报（静音、重新发送、切换通道、卸载都用它）——音频与语音合成一起停 */
  cancel() {
    // 使所有在途的合成请求作废，防止它们随后又播出声音
    this.token += 1

    if (this.audio) {
      const audio = this.audio
      this.audio = null
      try {
        audio.pause()
        audio.currentTime = 0
        audio.removeAttribute('src')
        audio.load()
      } catch {
        /* 忽略：不同实现对已卸载的 audio 会抛错 */
      }
    }

    if (this.synthesis) {
      try {
        this.synthesis.cancel()
      } catch {
        /* 忽略：部分实现对 cancel 会抛错 */
      }
    }
    this.utterance = null
    this.hooks.onEnd()
  }

  /** 卸载：解掉回调，避免异步 onend 回调到已销毁的组件上 */
  dispose() {
    this.cancel()
    if (this.utterance) {
      this.utterance.onend = null
      this.utterance.onerror = null
    }
    this.utterance = null
    if (this.audio) {
      this.audio.onplay = null
      this.audio.onended = null
      this.audio.onerror = null
      this.audio = null
    }
    this.synthesis = null
  }
}

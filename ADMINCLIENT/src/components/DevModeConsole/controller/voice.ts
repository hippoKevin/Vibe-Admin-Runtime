/**
 * 开发模式 · 麦克风与语音识别
 *
 * 从 ADMINSERVER/public/dev-agent-console.html 移植：语音识别结果「追加」到输入框，
 * 出错只提示、自动退回文字输入；连续模式被浏览器结束后有限次自动续接。
 */

/** 自动续接的最大次数（避免失败时无限重启） */
const MAX_RESTART = 5

/** 语音识别实例（浏览器实现，TS 标准库里没有，这里按用到的字段声明） */
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface AudioHooks {
  /** 拿到一段确定的识别文本（追加到输入框） */
  onFinalText: (text: string) => void
  /** 临时识别结果（显示在音轨上） */
  onInterimText: (text: string) => void
  /** 提示信息（isError 为 true 时按错误样式显示） */
  onHint: (text: string, isError?: boolean) => void
  /** 麦克风或识别彻底不可用，调用方应退回文字输入 */
  onFallback: (hint: string) => void
}

export class VoiceInput {
  private hooks: AudioHooks
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private timeData: Uint8Array | null = null
  private recognition: SpeechRecognitionLike | null = null
  private suppressAutoSend = false
  private session = 0
  private restartCount = 0

  constructor(hooks: AudioHooks) {
    this.hooks = hooks
  }

  /** 当前 analyser（帧循环拿它取音量与波形） */
  get node() {
    return this.analyser
  }

  /** 当前时域数据缓冲 */
  get data() {
    return this.timeData
  }

  /** 开始聆听：先申请麦克风（成功后再启动识别） */
  async start() {
    const session = (this.session += 1)
    this.suppressAutoSend = false
    this.restartCount = 0
    this.hooks.onHint('devMode.micRequesting')

    await this.startAudio(session)
    if (session !== this.session) return
    this.startRecognition()
  }

  /** 停止：识别与麦克风一起收掉 */
  stop() {
    this.session += 1
    this.stopRecognition()
    this.stopAudio()
  }

  /** 提交任务前收回麦克风：避免把环境音当成新的需求 */
  suspend() {
    this.stopRecognition()
    this.stopAudio()
  }

  private async startAudio(session: number) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.hooks.onHint('devMode.micUnsupported', true)
      this.hooks.onFallback('devMode.micUnsupported')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      this.hooks.onHint('devMode.micDenied', true)
      this.hooks.onFallback('devMode.micDenied')
      return
    }

    if (session !== this.session) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    this.stream = stream

    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) {
        this.hooks.onHint('devMode.audioUnsupported', true)
        this.hooks.onFallback('devMode.audioUnsupported')
        return
      }

      this.audioContext = new Ctx()
      if (this.audioContext.state === 'suspended') await this.audioContext.resume()

      if (session !== this.session) {
        this.stopAudio()
        return
      }

      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.85
      source.connect(this.analyser)
      this.timeData = new Uint8Array(this.analyser.fftSize)

      this.hooks.onHint('devMode.micListening')
    } catch {
      this.hooks.onHint('devMode.audioFailed', true)
      this.hooks.onFallback('devMode.audioFailed')
    }
  }

  private stopAudio() {
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => track.stop())
      } catch {
        /* 忽略 */
      }
      this.stream = null
    }

    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch {
        /* 忽略 */
      }
      this.audioContext = null
    }

    this.analyser = null
    this.timeData = null
  }

  private startRecognition() {
    this.recognition = this.createRecognition()
    if (!this.recognition) {
      // 没有语音识别能力时仍保留音轨形态（可见、可切回文字），只提示不可用
      this.hooks.onHint('devMode.speechUnsupported')
      this.hooks.onInterimText('devMode.speechUnsupported')
      return
    }
    try {
      this.recognition.start()
    } catch {
      /* 忽略：重复 start 会抛错 */
    }
  }

  private stopRecognition() {
    this.suppressAutoSend = true
    if (!this.recognition) return
    this.recognition.onend = null
    this.recognition.onresult = null
    this.recognition.onerror = null
    try {
      this.recognition.stop()
    } catch {
      /* 忽略：可能已经停止 */
    }
    this.recognition = null
  }

  private createRecognition(): SpeechRecognitionLike | null {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Recognition) return null

    let instance: SpeechRecognitionLike
    try {
      instance = new Recognition()
    } catch {
      return null
    }

    instance.lang = 'zh-CN'
    instance.continuous = true
    instance.interimResults = true

    instance.onresult = (event: any) => {
      this.restartCount = 0
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const item = event.results[i]
        const text = item && item[0] ? item[0].transcript || '' : ''
        if (item && item.isFinal) this.hooks.onFinalText(text)
        else interim += text
      }
      this.hooks.onInterimText(interim)
    }

    // 识别层的错误只提示、不抛出；真正的「无权限/无设备」由 getUserMedia 决定是否退回文字输入
    instance.onerror = (event: any) => {
      const reason = event && event.error ? event.error : ''

      if (reason === 'audio-capture') {
        this.restartCount = MAX_RESTART
        this.hooks.onHint('devMode.micDenied', true)
        this.hooks.onFallback('devMode.micDenied')
        return
      }
      if (reason === 'not-allowed' || reason === 'service-not-allowed') {
        this.restartCount = MAX_RESTART
        this.hooks.onHint('devMode.speechDenied')
        return
      }
      if (reason === 'network') {
        this.restartCount = MAX_RESTART
        this.hooks.onHint('devMode.speechNetwork')
        return
      }
      this.restartCount = MAX_RESTART
      this.hooks.onHint('devMode.speechError', true)
    }

    instance.onend = () => {
      // 连续模式会被浏览器定时结束：有限次自动续接，避免失败时无限重启
      if (this.suppressAutoSend || !this.recognition) return
      if (this.restartCount >= MAX_RESTART) {
        this.hooks.onHint('devMode.speechStopped')
        return
      }
      this.restartCount += 1
      window.setTimeout(() => {
        if (this.suppressAutoSend || !this.recognition) return
        try {
          this.recognition.start()
        } catch {
          /* 忽略：可能已经启动 */
        }
      }, 320)
    }

    return instance
  }
}

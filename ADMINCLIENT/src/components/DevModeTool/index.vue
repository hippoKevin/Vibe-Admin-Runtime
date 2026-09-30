<template>
  <t-tooltip :content="$t('devMode.button')">
    <t-button ref="triggerRef" variant="text" shape="square" data-testid="dev-mode-trigger" @click="handleTrigger">
      <template #icon>
        <RocketIcon size="20px" />
      </template>
    </t-button>
  </t-tooltip>

  <Teleport to="body">
    <!-- 整屏神经网络律动层（不接收鼠标事件） -->
    <canvas v-if="visible" ref="meshRef" class="dev-mesh" data-testid="dev-mesh"></canvas>

    <div
      v-if="visible"
      ref="rootRef"
      class="dev-ball"
      :class="{ 'dev-ball--busy': isGenerating }"
      data-testid="dev-mode-ball"
    >
      <!-- 待机/聆听：向外扩散到整屏的淡淡涟漪 -->
      <span class="dev-ball__ripple dev-ball__ripple--1"></span>
      <span class="dev-ball__ripple dev-ball__ripple--2"></span>
      <span class="dev-ball__ripple dev-ball__ripple--3"></span>

      <!-- 执行中：整屏向外释放的波纹 -->
      <span class="dev-ball__rings" data-testid="dev-ball-rings">
        <span class="dev-ball__ring dev-ball__ring--1"></span>
        <span class="dev-ball__ring dev-ball__ring--2"></span>
        <span class="dev-ball__ring dev-ball__ring--3"></span>
        <span class="dev-ball__ring dev-ball__ring--4"></span>
      </span>

      <!-- 中心神经网络主体（画在整屏 canvas 上；这里只留点击热区） -->
      <button
        type="button"
        class="dev-ball__core"
        :title="$t('devMode.button')"
        data-testid="dev-mode-orb"
        @click="handleBallClick"
      ></button>

      <!-- 两个很小的按钮：文本输入 / 退出 -->
      <div class="dev-ball__actions">
        <button
          type="button"
          class="dev-ball__action"
          :title="$t('devMode.textInput')"
          data-testid="dev-mode-text-toggle"
          @click="toggleInput"
        >
          <Edit1Icon size="13px" />
        </button>
        <button
          type="button"
          class="dev-ball__action"
          :title="$t('devMode.exit')"
          data-testid="dev-mode-exit"
          @click="handleClose"
        >
          <CloseIcon size="13px" />
        </button>
      </div>

      <!-- 球上方的信息区（默认不接收鼠标事件） -->
      <div class="dev-ball__stack">
        <div class="dev-ball__info">
          <div v-if="isGenerating" class="dev-ball__line" data-testid="dev-ball-state">
            <LoadingIcon class="dev-ball__spin-icon" size="13px" />
            <span>{{ $t('devMode.generating') }}</span>
          </div>

          <div v-else-if="errorText" class="dev-ball__line dev-ball__line--error" data-testid="dev-mode-error">
            <ErrorCircleIcon size="13px" />
            <span class="dev-ball__clamp">{{ errorText }}</span>
          </div>

          <template v-else-if="result">
            <div class="dev-ball__line" data-testid="dev-mode-result">
              <CheckCircleIcon size="13px" />
              <span class="dev-ball__title">{{ $t('devMode.outputTitle') }}</span>
            </div>
            <p class="dev-ball__text dev-ball__text--clamp">{{ outputText }}</p>
            <ul v-if="visibleFiles.length" class="dev-ball__files">
              <li v-for="file in visibleFiles" :key="file.path" class="dev-ball__file">
                <span class="dev-ball__file-status" :class="`dev-ball__file-status--${file.statusKey}`">
                  {{ $t(`devMode.fileStatus.${file.statusKey}`) }}
                </span>
                <span class="dev-ball__file-path">{{ file.path }}</span>
              </li>
            </ul>
            <span v-if="hiddenFileCount > 0" class="dev-ball__more">
              {{ $t('devMode.moreFiles', { count: hiddenFileCount }) }}
            </span>
            <span v-if="countdownText" class="dev-ball__more dev-ball__more--brand">{{ countdownText }}</span>
          </template>

          <div v-else class="dev-ball__line" data-testid="dev-ball-state">
            <MicrophoneIcon v-if="isListening" size="13px" />
            <SoundIcon v-else size="13px" />
            <span class="dev-ball__clamp">{{ stateText }}</span>
          </div>
        </div>

        <!-- 文本输入：点了才出现 -->
        <div v-if="inputVisible" class="dev-ball__input" data-testid="dev-mode-input">
          <input
            v-model="manualText"
            class="dev-ball__field"
            type="text"
            :placeholder="$t('devMode.promptPlaceholder')"
            @keyup.enter="handleGenerate"
          />
          <button type="button" class="dev-ball__send" :title="$t('devMode.send')" @click="handleGenerate">
            <SendIcon size="13px" />
          </button>
        </div>
      </div>

      <!-- 白色波形音轨（球下方，可上下拖动） -->
      <div
        class="dev-ball__track"
        :class="{ 'dev-ball__track--hidden': isGenerating }"
        :style="{ top: trackTop }"
        data-testid="dev-mode-track"
        @pointerdown="handleTrackDragStart"
      >
        <span class="dev-ball__handle"></span>
        <canvas ref="waveRef" class="dev-ball__wave" data-testid="dev-wave"></canvas>
        <span class="dev-ball__brand">vibe-admin-runtime</span>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
export default {
  name: 'DevModeTool',
}
</script>

<script lang="ts" setup>
// 1. 第三方依赖
import {
  CheckCircleIcon, CloseIcon, Edit1Icon, ErrorCircleIcon, LoadingIcon,
  MicrophoneIcon, RocketIcon, SendIcon, SoundIcon,
} from 'tdesign-icons-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
// 2. 工程内工具
import { useI18n } from 'vue-i18n'
// 3. 接口
import * as api from './api'
import type { DevAgentRunResult, DevAgentStatus } from './api'

const { t } = useI18n()

/**
 * Data Setting
 * 数据配置
 */
const visible = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const meshRef = ref<HTMLCanvasElement | null>(null)
const waveRef = ref<HTMLCanvasElement | null>(null)
const triggerRef = ref<any>(null)

const statusChecking = ref(false)
const statusHint = ref('')
const status = ref<DevAgentStatus | null>(null)

const finalText = ref('')
const interimText = ref('')
const manualText = ref('')
const inputVisible = ref(false)

const isGenerating = ref(false)
const result = ref<DevAgentRunResult | null>(null)
const errorText = ref('')
const countdownText = ref('')

/** 语音识别是否可用（不可用时用文本输入兜底） */
const speechSupported = ref(true)
/** 麦克风是否被拒绝或不可用 */
const micDenied = ref(false)
/** 是否正在聆听（麦克风轨道已建立） */
const isListening = ref(false)

/** 音轨相对球下沿的垂直偏移（px），可上下拖动 */
const trackOffset = ref(48)

/** 中心球体的外沿半径（与 index.scss / 球面半径保持一致），用于摆放音轨 */
const BALL_RADIUS = 124
/** 音轨偏移的持久化 key */
const TRACK_KEY = 'dev-mode-track-offset'
/** 音轨偏移范围 */
const TRACK_MIN = 8
const TRACK_MAX = 360
/** 单次结果最多展示的文件数 */
const MAX_FILES = 8
/** 展示结果后延迟刷新的时间（毫秒） */
const RELOAD_DELAY = 1500

/**
 * Computed Setting
 * 计算属性
 */
const isReady = computed(() => status.value?.ready === true)

/** 音轨的垂直位置：球心 + 球半径 + 偏移 */
const trackTop = computed(() => `calc(50% + ${BALL_RADIUS}px + ${trackOffset.value}px)`)

/** 交给后端的任务描述：语音转写优先，回退文本输入 */
const promptText = computed(() => {
  const voice = `${finalText.value}${interimText.value}`.trim()
  return voice || manualText.value.trim()
})

/** 球上方那一行很淡的状态字 */
const stateText = computed(() => {
  if (statusChecking.value) return t('devMode.statusChecking')
  if (!isReady.value) return statusHint.value || t('devMode.notReadyHint')
  if (micDenied.value) return t('devMode.micDenied')
  if (!speechSupported.value) return t('devMode.micUnsupported')
  if (isListening.value) return t('devMode.micListening')
  return t('devMode.micIdle')
})

/** Agent 答复：截断，避免长文本/JSON */
const outputText = computed(() => {
  const raw = String(result.value?.output || result.value?.reasoningTail || '').replace(/\s*\n\s*/g, '\n').trim()
  if (!raw) return t('devMode.outputEmpty')
  return raw.length > 160 ? `${raw.slice(0, 160)}…` : raw
})

/** 改动文件：只保留前 8 个，超出部分计数展示 */
const visibleFiles = computed(() => {
  const files = result.value?.files ?? []
  return files.slice(0, MAX_FILES).map((file) => ({
    path: file.path,
    statusKey: normalizeStatus(file.status),
  }))
})

const hiddenFileCount = computed(() => Math.max(0, (result.value?.files?.length ?? 0) - MAX_FILES))

/**
 * Method Setting
 * 方法配置
 */

/** git status 的两字符状态码归一化为 i18n 键名 */
function normalizeStatus(statusCode: string): string {
  const code = String(statusCode || '').trim().toUpperCase()
  if (code === 'M') return 'modified'
  if (code === 'A') return 'added'
  if (code === 'D') return 'deleted'
  if (code === 'R') return 'renamed'
  if (code === '??' || code === '?') return 'untracked'
  return 'changed'
}

/**
 * Track Setting
 * 音轨配置（上下拖动 + localStorage 持久化）
 */
function loadTrackOffset(): number {
  try {
    const value = Number(localStorage.getItem(TRACK_KEY))
    if (Number.isFinite(value) && value > 0) return clampTrackOffset(value)
  } catch {
    /* 忽略：读不到就用默认值 */
  }
  return 48
}

function clampTrackOffset(value: number) {
  return Math.min(Math.max(TRACK_MIN, Math.round(value)), TRACK_MAX)
}

let trackDrag: { startY: number; origin: number } | null = null

/** 按住音轨（或它上方的把手）开始上下拖动 */
function handleTrackDragStart(event: PointerEvent) {
  if (event.button !== 0) return
  trackDrag = { startY: event.clientY, origin: trackOffset.value }
  window.addEventListener('pointermove', handleTrackDragMove)
  window.addEventListener('pointerup', handleTrackDragEnd)
  event.preventDefault()
}

function handleTrackDragMove(event: PointerEvent) {
  if (!trackDrag) return
  trackOffset.value = clampTrackOffset(trackDrag.origin + (event.clientY - trackDrag.startY))
}

function handleTrackDragEnd() {
  trackDrag = null
  window.removeEventListener('pointermove', handleTrackDragMove)
  window.removeEventListener('pointerup', handleTrackDragEnd)
  try {
    localStorage.setItem(TRACK_KEY, String(trackOffset.value))
  } catch {
    /* 忽略：隐私模式下可能写不进去 */
  }
}

/** 组装语音识别实例（不支持时返回 null） */
function createRecognition(): any {
  const win = window as any
  const Recognition = win.SpeechRecognition || win.webkitSpeechRecognition
  if (!Recognition) return null

  const recognition = new Recognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = true
  recognition.interimResults = true

  recognition.onresult = (event: any) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const item = event.results[i]
      const text = item?.[0]?.transcript ?? ''
      if (item?.isFinal) finalText.value += text
      else interim += text
    }
    interimText.value = interim
  }

  recognition.onerror = (event: any) => {
    if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
      micDenied.value = true
    }
    interimText.value = ''
  }

  recognition.onend = () => {
    interimText.value = ''
    // 说完（识别结束且已有文本）自动进入生成流程
    if (!suppressAutoGenerate && !isGenerating.value && finalText.value.trim()) {
      handleGenerate()
    }
  }

  return recognition
}

/**
 * Audio Setting
 * 音频配置
 */
let audioStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let timeData: Uint8Array<ArrayBuffer> | null = null
let recognition: any = null
let suppressAutoGenerate = false
let reloadTimer: ReturnType<typeof setTimeout> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
/** 会话号：球关闭/重开一次自增，用于丢弃过期的异步话筒初始化 */
let session = 0
/** 平滑后的音量（0~1） */
let smoothLevel = 0

/** 读取品牌色并换出色相，拿不到就用兜底色相 */
function readBrandColor() {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--td-brand-color').trim()
    const parsed = parseColor(value)
    if (parsed) baseHue = rgbToHue(parsed.r, parsed.g, parsed.b)
  } catch {
    /* 忽略：拿不到就用兜底色相 */
  }
}

/**
 * 启动麦克风与分析器
 * 任何一步失败都只更新提示，不抛异常
 * @param token 会话号，异步返回时若已过期则直接丢弃并停掉轨道
 */
async function startAudio(token: number) {
  if (!navigator.mediaDevices?.getUserMedia) {
    micDenied.value = true
    return
  }

  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    micDenied.value = true
    return
  }

  // 等待期间球已被关闭：立刻关掉轨道，避免麦克风一直开着
  if (token !== session) {
    stream.getTracks().forEach((track) => track.stop())
    return
  }
  audioStream = stream

  try {
    const Ctx: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) {
      micDenied.value = true
      return
    }

    audioContext = new Ctx()
    if (audioContext.state === 'suspended') await audioContext.resume()

    if (token !== session) {
      stopAudio()
      return
    }

    const source = audioContext.createMediaStreamSource(audioStream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.85
    source.connect(analyser)

    timeData = new Uint8Array(analyser.fftSize)
    isListening.value = true
  } catch {
    micDenied.value = true
  }
}

/** 释放麦克风、AudioContext 与动画帧 */
function stopAudio() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }

  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop())
    audioStream = null
  }

  if (audioContext) {
    audioContext.close().catch(() => { /* 忽略关闭异常 */ })
    audioContext = null
  }

  analyser = null
  timeData = null
  smoothLevel = 0
  isListening.value = false
  applyLevel(0)
}

/** 把音量写进 CSS 变量：球轻微缩放（最多 +8%），涟漪略微增强 */
function applyLevel(value: number) {
  const el = rootRef.value
  if (!el) return
  el.style.setProperty('--dev-ball-scale', String(1 + value * 0.08))
  el.style.setProperty('--dev-level', value.toFixed(3))
}

/**
 * Mesh Setting
 * 整屏神经网络：中心一个球面神经网络（有体积、带球面波）+ 向外扩散的整屏稀疏网格，
 * 全部在同一层 canvas 画完，中心与外围是同一个场。
 */
interface SphereNode {
  /** 单位球面方向（Fibonacci 均匀分布；球内核节点为缩放后的方向） */
  ux: number
  uy: number
  uz: number
  /** 球面波用的方位角 / 极角 */
  u: number
  v: number
  /** 突触放电相位 */
  phase: number
  /** 层级：0 小 / 1 中 / 2 大（带 bloom） */
  tier: number
  /** 是否球内核心节点 */
  isCore: boolean
  /** 逐帧缓存：放电强度 */
  fire: number
  /** 归一化三维坐标（px，用于近邻判定） */
  tx: number
  ty: number
  tz: number
  /** 屏幕坐标 */
  sx: number
  sy: number
  /** 深度 0(最远) ~ 1(最近) */
  depth: number
  size: number
  alpha: number
}

interface FieldNode {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  fire: number
  dx: number
  dy: number
}

let sphereNodes: SphereNode[] = []
let fieldNodes: FieldNode[] = []
let meshWidth = 0
let meshHeight = 0
let meshDpr = 1
let meshLastTime = 0
/** 执行态过渡量：0=神经网络聚合，1=完全散开淡出 */
let busyMix = 0
/** 品牌色色相（用于缓慢色相漂移） */
let baseHue = 214

/** 中心球体半径（px） */
const SPHERE_RADIUS = 118
/** 球面节点数（Fibonacci 分布） */
const SPHERE_NODE_COUNT = 186
/** 球内核心节点数（做"实心"感） */
const SPHERE_CORE_COUNT = 14
/** 球面近邻连线阈值（占半径比例） */
const SPHERE_LINK_RATIO = 0.5
/** 球面与外围网格的桥接连线长度 */
const BRIDGE_LINK_DIST = 165
/** 每个外围节点最多桥接几个球面节点（避免拉出放射状的"星芒"） */
const BRIDGE_MAX = 2
/** 外围网格自身的连线阈值 */
const FIELD_LINK_DIST = 152
/** 外围网格避让球体的半径 */
const FIELD_HOLE_RADIUS = 152

/** 解析品牌色 → RGB，失败返回 null */
function parseColor(value: string): { r: number; g: number; b: number } | null {
  const text = String(value || '').trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)
  if (hex) {
    let body = hex[1] ?? ''
    if (body.length === 3) body = body.split('').map((c) => c + c).join('')
    return {
      r: parseInt(body.slice(0, 2), 16),
      g: parseInt(body.slice(2, 4), 16),
      b: parseInt(body.slice(4, 6), 16),
    }
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(text)
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }
  return null
}

/** RGB → 色相（0~360） */
function rgbToHue(r: number, g: number, b: number): number {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  if (delta === 0) return 214
  let hue = 0
  if (max === rn) hue = ((gn - bn) / delta) % 6
  else if (max === gn) hue = (bn - rn) / delta + 2
  else hue = (rn - gn) / delta + 4
  return (hue * 60 + 360) % 360
}

/** 单位球面上随机方向 */
function randomUnitVector(): { x: number; y: number; z: number } {
  const z = Math.random() * 2 - 1
  const angle = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.max(0, 1 - z * z))
  return { x: Math.cos(angle) * r, y: z, z: Math.sin(angle) * r }
}

/** 生成中心球面节点（含少量球内核节点）与外围整屏稀疏网格 */
function initMeshNodes(width: number, height: number) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  sphereNodes = []

  // 球面：Fibonacci 均匀分布
  for (let i = 0; i < SPHERE_NODE_COUNT; i += 1) {
    const y = 1 - (i / (SPHERE_NODE_COUNT - 1)) * 2
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    const roll = Math.random()
    sphereNodes.push({
      ux: Math.cos(theta) * ring,
      uy: y,
      uz: Math.sin(theta) * ring,
      u: theta,
      v: Math.acos(Math.min(1, Math.max(-1, y))),
      phase: Math.random() * Math.PI * 2,
      tier: roll > 0.88 ? 2 : roll > 0.58 ? 1 : 0,
      isCore: false,
      fire: 0,
      tx: 0,
      ty: 0,
      tz: 0,
      sx: 0,
      sy: 0,
      depth: 0.5,
      size: 1,
      alpha: 1,
    })
  }

  // 球内核心节点：让球有"实心"的体积感
  for (let i = 0; i < SPHERE_CORE_COUNT; i += 1) {
    const dir = randomUnitVector()
    const shrink = 0.3 + Math.random() * 0.52
    sphereNodes.push({
      ux: dir.x * shrink,
      uy: dir.y * shrink,
      uz: dir.z * shrink,
      u: Math.random() * Math.PI * 2,
      v: Math.random() * Math.PI,
      phase: Math.random() * Math.PI * 2,
      tier: 1,
      isCore: true,
      fire: 0,
      tx: 0,
      ty: 0,
      tz: 0,
      sx: 0,
      sy: 0,
      depth: 0.5,
      size: 1,
      alpha: 1,
    })
  }

  // 外围：整屏稀疏网格（避开球体）
  const cx = width / 2
  const cy = height / 2
  const fieldCount = Math.min(96, Math.max(56, Math.round((width * height) / 22000)))
  fieldNodes = []
  let guard = 0
  while (fieldNodes.length < fieldCount && guard < 4000) {
    guard += 1
    const x = Math.random() * width
    const y = Math.random() * height
    if (Math.hypot(x - cx, y - cy) < FIELD_HOLE_RADIUS) continue
    fieldNodes.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      fire: 0,
      dx: 0,
      dy: 0,
    })
  }
}

/** 释放节点与过渡状态（退出时调用） */
function resetMesh() {
  sphereNodes = []
  fieldNodes = []
  meshLastTime = 0
  busyMix = 0
}

/** 适配 devicePixelRatio；首次进入生成节点，尺寸变化只把节点收敛回视口 */
function resizeMesh() {
  const canvas = meshRef.value
  if (!canvas) return

  meshDpr = window.devicePixelRatio || 1
  meshWidth = window.innerWidth
  meshHeight = window.innerHeight
  canvas.width = Math.max(1, Math.floor(meshWidth * meshDpr))
  canvas.height = Math.max(1, Math.floor(meshHeight * meshDpr))

  if (!sphereNodes.length) initMeshNodes(meshWidth, meshHeight)

  // 便于排查/自检：把节点规模挂到 canvas 上
  canvas.dataset.nodes = String(sphereNodes.length)
  canvas.dataset.fieldNodes = String(fieldNodes.length)
}

/**
 * 画整屏神经网络场：
 * 球面节点按深度做近大远小/近亮远暗，沿法线叠加多个正弦做球面波并缓慢自转；
 * 球面波继续向外传播成整屏网格的涟漪；节点与连线用加法混合叠出实体感与 bloom。
 */
function drawMesh(now: number) {
  const canvas = meshRef.value
  if (!canvas || !meshWidth || !meshHeight) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dt = meshLastTime ? Math.min(48, now - meshLastTime) : 16
  meshLastTime = now

  ctx.setTransform(meshDpr, 0, 0, meshDpr, 0, 0)
  ctx.clearRect(0, 0, meshWidth, meshHeight)
  // 加法混合：重叠处更亮，球体才有"实体 + 发光"的观感
  ctx.globalCompositeOperation = 'lighter'

  const cx = meshWidth / 2
  const cy = meshHeight / 2

  // 执行态：中心散开淡出，结束后聚回
  const target = isGenerating.value ? 1 : 0
  busyMix += (target - busyMix) * Math.min(1, dt * 0.0045)
  const fade = 1 - busyMix

  // 缓慢自转（绕 Y 轴）+ 轻微摆动（绕 X 轴）
  const spin = (now / 1000) * 0.13
  const tilt = Math.sin(now / 5200) * 0.22
  const cosSpin = Math.cos(spin)
  const sinSpin = Math.sin(spin)
  const cosTilt = Math.cos(tilt)
  const sinTilt = Math.sin(tilt)

  // 波动随音量略微增强（幅度克制）
  const waveSpeed = 1 + smoothLevel * 0.55
  const t = (now / 1000) * waveSpeed
  const waveAmp = 0.085 + smoothLevel * 0.055
  const disperse = 1 + busyMix * 0.85

  // 品牌主色 + 相邻色相，缓慢漂移（约 50s 一轮）
  const hue = (baseHue + now / 140) % 360
  const colorA = `hsl(${hue}, 88%, 62%)`
  const colorB = `hsl(${(hue + 42) % 360}, 92%, 67%)`
  const colorC = `hsl(${(hue + 88) % 360}, 88%, 64%)`

  // 球体柔和底色：给"实体球"打底
  const glow = ctx.createRadialGradient(cx, cy, SPHERE_RADIUS * 0.08, cx, cy, SPHERE_RADIUS * 1.55)
  glow.addColorStop(0, `hsla(${hue}, 92%, 64%, ${0.34 * fade})`)
  glow.addColorStop(0.42, `hsla(${(hue + 40) % 360}, 92%, 62%, ${0.16 * fade})`)
  glow.addColorStop(1, `hsla(${(hue + 84) % 360}, 92%, 62%, 0)`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, SPHERE_RADIUS * 1.55, 0, Math.PI * 2)
  ctx.fill()

  // ── 球面节点：自转 + 球面波 + 深度层次 ──
  for (const node of sphereNodes) {
    const base = Math.hypot(node.ux, node.uy, node.uz) || 1
    // 球面波：几个正弦叠加，像水波在球面上跑
    const w1 = Math.sin(node.u * 3 + t * 1.15)
    const w2 = Math.sin(node.v * 4 - t * 0.95)
    const w3 = Math.sin((node.u + node.v) * 2 + t * 0.7)
    const wave = (0.42 * w1 + 0.34 * w2 + 0.24 * w3) * waveAmp * (node.isCore ? 0.35 : 1)
    const r = SPHERE_RADIUS * base * (1 + wave) * disperse

    const x1 = node.ux * cosSpin + node.uz * sinSpin
    const y1 = node.uy
    const z1 = -node.ux * sinSpin + node.uz * cosSpin
    const y2 = y1 * cosTilt - z1 * sinTilt
    const z2 = y1 * sinTilt + z1 * cosTilt

    node.tx = x1 * r
    node.ty = y2 * r
    node.tz = z2 * r

    // 透视：靠近观察者的一侧略微向外鼓，立体感更强
    const persp = 1 + z2 * 0.07
    node.sx = cx + node.tx * persp
    node.sy = cy + node.ty * persp
    // 近大远小、近亮远暗
    node.depth = (z2 + 1) / 2
    const tierScale = node.tier === 2 ? 1.8 : node.tier === 1 ? 1.35 : 1
    node.size = (0.7 + node.depth * 1.25) * tierScale
    node.alpha = (0.3 + node.depth * 0.7) * fade * (node.isCore ? 1.15 : 1)
    node.fire = 0.5 + 0.5 * Math.sin(now / 620 + node.phase)
  }

  // ── 连线：按透明度分桶批量描边（几千条边只 stroke 几次，帧率稳） ──
  const sphereLink = SPHERE_RADIUS * SPHERE_LINK_RATIO
  const sphereLink2 = sphereLink * sphereLink
  const sphereBuckets: number[][] = [[], [], [], [], [], [], []]

  for (let i = 0; i < sphereNodes.length; i += 1) {
    const a = sphereNodes[i]
    if (!a) continue
    for (let j = i + 1; j < sphereNodes.length; j += 1) {
      const b = sphereNodes[j]
      if (!b) continue
      const dx = a.tx - b.tx
      const dy = a.ty - b.ty
      const dz = a.tz - b.tz
      const dist2 = dx * dx + dy * dy + dz * dz
      if (dist2 > sphereLink2) continue

      const near = 1 - Math.sqrt(dist2) / sphereLink
      // 背面压暗 + 突触放电明暗流动
      const depthMix = Math.min(a.depth, b.depth)
      const firing = 0.35 + 0.65 * (a.fire + b.fire) * 0.5
      const alpha = (0.2 + depthMix * 0.7) * near * firing * fade
      const bucket = Math.min(sphereBuckets.length - 1, Math.max(0, Math.floor(alpha / 0.14)))
      sphereBuckets[bucket]?.push(a.sx, a.sy, b.sx, b.sy)
    }
  }

  // ── 外围网格：整屏漂移 + 由球面波传出去的涟漪 ──
  const fieldBuckets: number[][] = [[], [], [], [], [], []]
  const fieldLink2 = FIELD_LINK_DIST * FIELD_LINK_DIST
  const bridgeLink2 = BRIDGE_LINK_DIST * BRIDGE_LINK_DIST

  for (const node of fieldNodes) {
    node.x += node.vx
    node.y += node.vy
    if (node.x <= 0 || node.x >= meshWidth) node.vx *= -1
    if (node.y <= 0 || node.y >= meshHeight) node.vy *= -1
    node.x = Math.min(Math.max(node.x, 0), meshWidth)
    node.y = Math.min(Math.max(node.y, 0), meshHeight)

    const ox = node.x - cx
    const oy = node.y - cy
    const dist = Math.hypot(ox, oy) || 1
    // 球面波 → 外围网格波：沿径向起伏并向外传播，随距离衰减
    const ripple = Math.sin(dist / 52 - t * 1.5 + node.phase * 0.25)
      * (0.55 + smoothLevel * 0.45) * Math.exp(-dist / 560) * 15
    node.dx = node.x + (ox / dist) * ripple
    node.dy = node.y + (oy / dist) * ripple
    node.fire = 0.5 + 0.5 * Math.sin(now / 700 + node.phase)
  }

  for (let i = 0; i < fieldNodes.length; i += 1) {
    const a = fieldNodes[i]
    if (!a) continue

    for (let j = i + 1; j < fieldNodes.length; j += 1) {
      const b = fieldNodes[j]
      if (!b) continue
      const dx = a.dx - b.dx
      const dy = a.dy - b.dy
      const dist2 = dx * dx + dy * dy
      if (dist2 > fieldLink2) continue

      const near = 1 - Math.sqrt(dist2) / FIELD_LINK_DIST
      const firing = 0.4 + 0.6 * (a.fire + b.fire) * 0.5
      // 外围比中心淡，但保持可见的结构
      const alpha = (0.14 + smoothLevel * 0.1) * near * firing * fade
      const bucket = Math.min(fieldBuckets.length - 1, Math.max(0, Math.floor(alpha / 0.08)))
      fieldBuckets[bucket]?.push(a.dx, a.dy, b.dx, b.dy)
    }

    // 球面 ↔ 外围：只连最近的少量球面节点，让中心和整屏是同一个场，
    // 同时避免一个外围节点连出几十条线形成放射状"星芒"
    const bridgeCandidates: { d: number; x: number; y: number }[] = []
    for (const s of sphereNodes) {
      const dx = a.dx - s.sx
      const dy = a.dy - s.sy
      const dist2 = dx * dx + dy * dy
      if (dist2 > bridgeLink2) continue
      bridgeCandidates.push({ d: Math.sqrt(dist2), x: s.sx, y: s.sy })
    }
    if (bridgeCandidates.length > 1) bridgeCandidates.sort((p, q) => p.d - q.d)
    for (let k = 0; k < Math.min(BRIDGE_MAX, bridgeCandidates.length); k += 1) {
      const hit = bridgeCandidates[k]
      if (!hit) continue
      const near = 1 - hit.d / BRIDGE_LINK_DIST
      const alpha = 0.34 * near * fade
      const bucket = Math.min(fieldBuckets.length - 1, Math.max(0, Math.floor(alpha / 0.08)))
      fieldBuckets[bucket]?.push(a.dx, a.dy, hit.x, hit.y)
    }
  }

  /** 批量描边 */
  const strokeBuckets = (buckets: number[][], step: number, offset: number) => {
    for (let b = 0; b < buckets.length; b += 1) {
      const seg = buckets[b]
      if (!seg || !seg.length) continue
      ctx.globalAlpha = Math.min(0.9, offset + (b + 0.5) * step)
      ctx.beginPath()
      for (let i = 0; i < seg.length; i += 4) {
        ctx.moveTo(seg[i] ?? 0, seg[i + 1] ?? 0)
        ctx.lineTo(seg[i + 2] ?? 0, seg[i + 3] ?? 0)
      }
      ctx.stroke()
    }
  }

  // 外围连线
  const fieldStroke = ctx.createLinearGradient(0, 0, meshWidth, meshHeight)
  fieldStroke.addColorStop(0, colorA)
  fieldStroke.addColorStop(0.5, colorB)
  fieldStroke.addColorStop(1, colorC)
  ctx.strokeStyle = fieldStroke
  ctx.lineWidth = 1
  strokeBuckets(fieldBuckets, 0.08, 0.05)

  // 球面连线（更粗更亮）
  const sphereStroke = ctx.createLinearGradient(
    cx - SPHERE_RADIUS, cy - SPHERE_RADIUS, cx + SPHERE_RADIUS, cy + SPHERE_RADIUS,
  )
  sphereStroke.addColorStop(0, colorA)
  sphereStroke.addColorStop(0.5, colorB)
  sphereStroke.addColorStop(1, colorC)
  ctx.strokeStyle = sphereStroke
  ctx.lineWidth = 1.25 + smoothLevel * 0.75
  strokeBuckets(sphereBuckets, 0.14, 0.08)

  // ── 外围网格节点 ──
  ctx.fillStyle = fieldStroke
  const fieldDotBuckets: number[][] = [[], [], [], [], []]
  for (const node of fieldNodes) {
    const alpha = (0.3 + smoothLevel * 0.18) * (0.6 + node.fire * 0.7) * fade
    const bucket = Math.min(fieldDotBuckets.length - 1, Math.max(0, Math.floor(alpha / 0.14)))
    fieldDotBuckets[bucket]?.push(node.dx, node.dy, 1.15 + node.fire * 0.7)
  }
  for (let b = 0; b < fieldDotBuckets.length; b += 1) {
    const dots = fieldDotBuckets[b]
    if (!dots || !dots.length) continue
    ctx.globalAlpha = Math.min(0.85, 0.08 + (b + 0.5) * 0.14)
    ctx.beginPath()
    for (let i = 0; i < dots.length; i += 3) {
      const x = dots[i] ?? 0
      const y = dots[i + 1] ?? 0
      const r = Math.max(0.5, dots[i + 2] ?? 1)
      // arc 会从当前点连线到圆弧起点，必须先用 moveTo 起新子路径
      ctx.moveTo(x + r, y)
      ctx.arc(x, y, r, 0, Math.PI * 2)
    }
    ctx.fill()
  }

  // ── 球面节点：bloom 外发光（分两档批量画）+ 本体 ──
  ctx.fillStyle = sphereStroke
  const bloomPasses: { tier: number; scale: number; alpha: number }[] = [
    { tier: 2, scale: 4.4, alpha: 0.2 },
    { tier: 1, scale: 2.9, alpha: 0.1 },
  ]
  for (const pass of bloomPasses) {
    ctx.globalAlpha = pass.alpha * fade
    ctx.beginPath()
    let any = false
    for (const node of sphereNodes) {
      if (node.tier !== pass.tier) continue
      ctx.moveTo(node.sx + node.size * pass.scale, node.sy)
      ctx.arc(node.sx, node.sy, Math.max(0.6, node.size * pass.scale), 0, Math.PI * 2)
      any = true
    }
    if (any) ctx.fill()
  }

  const nodeBuckets: number[][] = [[], [], [], [], []]
  for (const node of sphereNodes) {
    const alpha = node.alpha * (0.5 + node.fire * 0.8)
    const bucket = Math.min(nodeBuckets.length - 1, Math.max(0, Math.floor(alpha / 0.18)))
    nodeBuckets[bucket]?.push(node.sx, node.sy, node.size)
  }
  for (let b = 0; b < nodeBuckets.length; b += 1) {
    const dots = nodeBuckets[b]
    if (!dots || !dots.length) continue
    ctx.globalAlpha = Math.min(0.95, 0.14 + (b + 0.5) * 0.18)
    ctx.beginPath()
    for (let i = 0; i < dots.length; i += 3) {
      const x = dots[i] ?? 0
      const y = dots[i + 1] ?? 0
      const r = Math.max(0.5, dots[i + 2] ?? 1)
      // 同上：arc 前必须 moveTo，否则相邻圆会被连成多边形
      ctx.moveTo(x + r, y)
      ctx.arc(x, y, r, 0, Math.PI * 2)
    }
    ctx.fill()
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

/**
 * Wave Setting
 * 白色波形音轨配置
 */
let waveDpr = 1

/** 画球下方的白色波形音轨 */
function drawWave() {
  const canvas = waveRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  waveDpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth || 264
  const height = canvas.clientHeight || 40
  const pixelWidth = Math.max(1, Math.floor(width * waveDpr))
  const pixelHeight = Math.max(1, Math.floor(height * waveDpr))
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  ctx.setTransform(waveDpr, 0, 0, waveDpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const mid = height / 2
  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.12)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.12)')

  ctx.save()
  ctx.beginPath()

  if (analyser && timeData) {
    analyser.getByteTimeDomainData(timeData)
    const step = Math.max(1, Math.floor(timeData.length / 140))
    let started = false
    for (let i = 0; i < timeData.length; i += step) {
      const value = ((timeData[i] ?? 128) - 128) / 128
      const x = (i / (timeData.length - 1)) * width
      const y = mid - value * mid * 0.92
      if (started) ctx.lineTo(x, y)
      else {
        ctx.moveTo(x, y)
        started = true
      }
    }
  } else {
    ctx.moveTo(0, mid)
    ctx.lineTo(width, mid)
  }

  // 先在浅色页面上垫一层深色柔光，白色波形才在任何背景上都看得出来
  ctx.strokeStyle = 'rgba(12, 18, 38, 0.42)'
  ctx.lineWidth = 4
  ctx.shadowColor = 'rgba(12, 18, 38, 0.5)'
  ctx.shadowBlur = 6
  ctx.stroke()

  // 再叠白色主体
  ctx.strokeStyle = gradient
  ctx.lineWidth = 1.6
  ctx.shadowColor = 'rgba(255, 255, 255, 0.6)'
  ctx.shadowBlur = 8
  ctx.stroke()

  ctx.restore()
}

/**
 * Loop Setting
 * 帧循环配置（音频电平 + 神经网络 + 音轨统一在一个 rAF 里）
 */
let rafId = 0

function tick() {
  rafId = 0
  if (document.hidden || !visible.value) return

  rafId = requestAnimationFrame(tick)
  const now = performance.now()

  let level = 0
  if (analyser && timeData) {
    analyser.getByteTimeDomainData(timeData)
    let sum = 0
    for (let i = 0; i < timeData.length; i += 1) {
      const value = ((timeData[i] ?? 128) - 128) / 128
      sum += value * value
    }
    level = Math.min(1, Math.sqrt(sum / timeData.length) * 4)
  }

  // 执行中：叠加一点缓慢脉动，让整屏释放的波纹持续往外走
  if (isGenerating.value) {
    level = Math.max(level, 0.45 + 0.25 * Math.sin(now / 260))
  }

  smoothLevel = smoothLevel * 0.85 + level * 0.15
  applyLevel(smoothLevel)
  drawMesh(now)
  drawWave()
}

function startLoop() {
  if (rafId || document.hidden) return
  rafId = requestAnimationFrame(tick)
}

/** 页面隐藏时暂停 rAF，回到前台再继续 */
function handleVisibility() {
  if (document.hidden) {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    return
  }
  if (visible.value) startLoop()
}

/** 窗口尺寸变化：重算整屏 canvas */
function handleResize() {
  if (!visible.value) return
  resizeMesh()
}

/**
 * Speech Setting
 * 语音配置
 */
function startRecognition() {
  recognition = createRecognition()
  if (!recognition) {
    speechSupported.value = false
    return
  }

  try {
    recognition.start()
  } catch {
    // 重复 start 会抛错，忽略即可
  }
}

/** 停止识别；suppress 为真时不触发自动生成 */
function stopRecognition(suppress = true) {
  if (suppress) suppressAutoGenerate = true
  if (!recognition) return

  recognition.onend = null
  recognition.onresult = null
  recognition.onerror = null
  try {
    recognition.stop()
  } catch {
    /* 忽略：可能已经停止 */
  }
  recognition = null
}

/**
 * Request Setting
 * 接口配置
 */
/** 查询 dsh 是否就绪 */
async function loadStatus() {
  statusChecking.value = true
  statusHint.value = ''

  try {
    const res = await api.getDevAgentStatus()
    if (res?.code === 2000 && res.data) {
      status.value = res.data as DevAgentStatus
      if (!status.value.ready) {
        statusHint.value = status.value.hint || t('devMode.notReadyHint')
      }
    } else {
      status.value = null
      statusHint.value = res?.message ?? res?.msg ?? t('devMode.statusFailed')
    }
  } catch (error: any) {
    status.value = null
    statusHint.value = error?.message || t('devMode.statusFailed')
  } finally {
    statusChecking.value = false
  }
}

/** 提交任务并展示结果 */
async function handleGenerate() {
  if (isGenerating.value) return

  const prompt = promptText.value
  if (!prompt) {
    MessagePlugin.warning(t('devMode.emptyPrompt'))
    return
  }
  if (!isReady.value) {
    MessagePlugin.warning(statusHint.value || t('devMode.notReady'))
    return
  }

  stopRecognition(true)
  inputVisible.value = false
  isGenerating.value = true
  result.value = null
  errorText.value = ''
  countdownText.value = ''

  try {
    const res = await api.generateCode({ prompt })
    if (res?.code === 2000 && res.data) {
      result.value = res.data as DevAgentRunResult
      if (result.value.ok) {
        scheduleReload()
      } else {
        errorText.value = result.value.error || t('devMode.generateFailed')
      }
    } else {
      errorText.value = res?.message ?? res?.msg ?? t('devMode.generateFailed')
    }
  } catch (error: any) {
    errorText.value = error?.message || t('devMode.requestFailed')
  } finally {
    isGenerating.value = false
  }
}

/** 让用户看清结果后再刷新，看到最终页面状态 */
function scheduleReload() {
  clearReloadTimers()
  let remain = Math.ceil(RELOAD_DELAY / 1000)
  countdownText.value = t('devMode.reloadTip', { seconds: remain })

  countdownTimer = setInterval(() => {
    remain -= 1
    countdownText.value = remain > 0 ? t('devMode.reloadTip', { seconds: remain }) : ''
  }, 1000)

  reloadTimer = setTimeout(() => {
    clearReloadTimers()
    window.location.reload()
  }, RELOAD_DELAY)
}

/** 清理刷新定时器 */
function clearReloadTimers() {
  if (reloadTimer) {
    clearTimeout(reloadTimer)
    reloadTimer = null
  }
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

/**
 * Ball Setting
 * 球体配置
 */
async function handleTrigger() {
  if (visible.value) {
    handleClose()
    return
  }
  await handleOpen()
}

/** 打开：开始采集 + 识别 + 查询就绪状态 + 启动整屏律动 */
async function handleOpen() {
  session += 1
  visible.value = true
  inputVisible.value = false
  trackOffset.value = loadTrackOffset()
  readBrandColor()
  loadStatus()
  startAudio(session)
  startRecognition()

  await nextTick()
  resizeMesh()
  applyLevel(0)
  startLoop()
}

/** 关闭：释放麦克风、关闭 AudioContext、取消 rAF、停止识别 */
function handleClose() {
  session += 1
  visible.value = false
  inputVisible.value = false
  clearReloadTimers()
  suppressAutoGenerate = true
  stopRecognition(true)
  stopAudio()
  countdownText.value = ''
  resetMesh()
}

/** 点击球：麦克风被拒或没在采集时重新尝试开启 */
function handleBallClick() {
  if (isGenerating.value || isListening.value) return
  session += 1
  micDenied.value = false
  startAudio(session)
  if (!recognition) startRecognition()
}

/** 展开/收起文本输入（默认语音优先） */
function toggleInput() {
  inputVisible.value = !inputVisible.value
}

/** Esc 退出 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value) handleClose()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResize)
  document.addEventListener('visibilitychange', handleVisibility)
})

onBeforeUnmount(() => {
  session += 1
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('visibilitychange', handleVisibility)
  window.removeEventListener('pointermove', handleTrackDragMove)
  window.removeEventListener('pointerup', handleTrackDragEnd)
  clearReloadTimers()
  suppressAutoGenerate = true
  stopRecognition(true)
  stopAudio()
  resetMesh()
})
</script>

<style lang="scss" scoped>@import url("./index.scss");</style>

<template>
  <!--
    开发模式：应用内的原生组件 + 一层幕布（不是弹窗、不是 iframe、不是新窗口）
    - 整屏浅色幕布 pointer-events: none，页面内容透过幕布可见、照常可点；
    - 球体 / 输入区 / 面板这些「实体」各自接收鼠标事件；
    - 挂载点固定在 App.vue，页面级热更新不会把它卸载，状态全部持久化在 localStorage。
  -->
  <div
    class="dev-mode"
    :class="{ 'dev-mode--busy': generating }"
    data-testid="dev-mode"
    :style="{ '--veil-alpha': String(veilAlpha / 100) }"
  >
    <div class="dev-mode__veil" data-testid="dev-mode-veil" />

    <div class="dev-mode__rings" :class="{ 'dev-mode__rings--busy': generating }" aria-hidden="true">
      <span class="dev-mode__ring dev-mode__ring--1" />
      <span class="dev-mode__ring dev-mode__ring--2" />
      <span class="dev-mode__ring dev-mode__ring--3" />
      <span class="dev-mode__ring dev-mode__ring--4" />
    </div>

    <canvas ref="meshRef" class="dev-mode__mesh" data-testid="dev-console-mesh" />

    <div class="dev-mode__layout">
      <header class="dev-mode__topbar">
        <span class="dev-mode__brand">vibe-admin-runtime</span>
        <span
          class="dev-mode__status"
          :class="{ 'dev-mode__status--error': statusError }"
          data-testid="dev-console-status"
        >{{ statusText }}</span>
        <button
          type="button"
          class="dev-mode__btn"
          data-testid="dev-mode-close"
          :title="$t('devMode.close')"
          @click="handleClose"
        >{{ $t('devMode.exit') }}</button>
      </header>

      <div ref="stageRef" class="dev-mode__stage">
        <div v-show="generating" class="dev-mode__busy" data-testid="dev-console-busy">
          <span class="dev-mode__busy-spin" />
          <span class="dev-mode__busy-text">{{ $t('devMode.generating') }}</span>
        </div>
      </div>

      <div
        class="dev-mode__dock"
        data-testid="dev-mode-dock"
        :style="{ transform: dockTransform }"
      >
        <!-- 拖动把手：音轨位置可在舞台里上下移动，位置持久化 -->
        <span
          class="dev-mode__dock-grip"
          data-testid="dev-mode-dock-grip"
          :title="$t('devMode.micIdle')"
          @pointerdown="handleDockDragStart"
        />

        <!-- 通道切换：快速回复（TTS 播报）/ 后台执行（改代码），选择持久化 -->
        <div class="dev-mode__channels" data-testid="dev-console-channels">
          <span class="dev-mode__channels-label">{{ $t('devMode.channelLabel') }}</span>
          <div class="dev-mode__channels-seg" role="group">
            <button
              type="button"
              class="dev-mode__seg"
              :class="{ 'dev-mode__seg--active': channel === 'reply' }"
              data-testid="dev-console-channel-reply"
              :aria-pressed="channel === 'reply' ? 'true' : 'false'"
              :title="$t('devMode.channelReplyTip')"
              @click="switchChannel('reply')"
            >{{ $t('devMode.channelReply') }}</button>
            <button
              type="button"
              class="dev-mode__seg"
              :class="{ 'dev-mode__seg--active': channel === 'code' }"
              data-testid="dev-console-channel-code"
              :aria-pressed="channel === 'code' ? 'true' : 'false'"
              :title="$t('devMode.channelCodeTip')"
              @click="switchChannel('code')"
            >{{ $t('devMode.channelCode') }}</button>
          </div>
          <span v-if="channel === 'reply'" class="dev-mode__speaking" data-testid="dev-console-speaking">
            <span class="dev-mode__speaking-dot" :class="{ 'dev-mode__speaking-dot--on': speaking }" />
            <span>{{ speaking ? $t('devMode.speaking') : (speechMuted ? $t('devMode.speakOff') : $t('devMode.speakOn')) }}</span>
          </span>
        </div>

        <!-- 本次执行结果 -->
        <section
          v-if="resultVisible"
          class="dev-mode__result"
          :class="{
            'dev-mode__result--reply': resultChannel === 'reply',
            'dev-mode__result--error': resultIsError,
            'dev-mode__result--pending': backgroundRunning,
          }"
          data-testid="dev-console-result"
        >
          <div class="dev-mode__result-head">
            <span class="dev-mode__dot" :class="{ 'dev-mode__dot--error': resultIsError }" />
            <span>{{ resultHeadline }}</span>
          </div>
          <p v-if="resultChannel === 'reply' && resultAnswer" class="dev-mode__answer" data-testid="dev-console-answer">
            {{ resultAnswer }}
          </p>
          <ul v-if="resultFiles.length" class="dev-mode__files">
            <li v-for="(file, index) in resultFiles" :key="`${file.path}-${index}`" class="dev-mode__file">
              <span class="dev-mode__tag" :class="`dev-mode__tag--${statusInfo(file.status).key}`">
                {{ statusInfo(file.status).label }}
              </span>
              <span class="dev-mode__path">{{ file.path }}</span>
            </li>
          </ul>
          <p
            v-if="resultFiles.length && resultChannel === 'reply'"
            class="dev-mode__warn"
            data-testid="dev-console-reply-warn"
          >{{ $t('devMode.replyFilesWarn', { count: resultFiles.length }) }}</p>
          <p v-else-if="!resultIsError && !resultFiles.length" class="dev-mode__muted">
            {{ resultChannel === 'reply' ? $t('devMode.replyNoFileHint') : $t('devMode.resultFilesEmpty') }}
          </p>
        </section>

        <!-- 输入框上方的「Agent 执行过程」开关 -->
        <button
          type="button"
          class="dev-mode__toggle"
          data-testid="dev-console-panel-toggle"
          :aria-expanded="panelOpen ? 'true' : 'false'"
          @click="togglePanel"
        >
          <span class="dev-mode__caret">{{ panelOpen ? '▾' : '▸' }}</span>
          <span>{{ $t('devMode.panelTitle') }}</span>
        </button>

        <!-- 输入区 / 音轨：默认文字输入，同一位置可切语音 -->
        <div class="dev-mode__row">
          <textarea
            v-if="mode === 'text'"
            ref="inputRef"
            v-model="draft"
            class="dev-mode__field"
            data-testid="dev-console-input"
            :placeholder="$t('devMode.promptPlaceholder')"
            @keydown="handleInputKeydown"
          />

          <div v-else class="dev-mode__track" data-testid="dev-console-track">
            <canvas ref="waveRef" class="dev-mode__wave" data-testid="dev-console-wave" />
            <span class="dev-mode__track-live" data-testid="dev-console-live">{{ liveText }}</span>
          </div>

          <button
            type="button"
            class="dev-mode__btn dev-mode__btn--icon"
            :class="{ 'dev-mode__btn--on': mode === 'voice' }"
            data-testid="dev-console-mode-toggle"
            :title="mode === 'voice' ? $t('devMode.modeToText') : $t('devMode.modeToVoice')"
            @click="handleToggleMode"
          >{{ mode === 'voice' ? '⌨' : '🎙' }}</button>

          <button
            v-if="channel === 'reply'"
            type="button"
            class="dev-mode__btn dev-mode__btn--icon"
            :class="{ 'dev-mode__btn--on': !speechMuted }"
            data-testid="dev-console-mute"
            :aria-pressed="speechMuted ? 'false' : 'true'"
            :title="speechMuted ? $t('devMode.muteOn') : $t('devMode.muteOff')"
            @click="handleToggleMute"
          >{{ speechMuted ? '🔇' : '🔊' }}</button>

          <button
            type="button"
            class="dev-mode__btn dev-mode__btn--primary"
            data-testid="dev-console-send"
            :disabled="!canSend"
            @click="handleGenerate"
          >{{ generating ? $t('devMode.generating') : $t('devMode.send') }}</button>
        </div>

        <div
          class="dev-mode__hint"
          :class="{ 'dev-mode__hint--error': hintIsError }"
          data-testid="dev-console-hint"
        >{{ hintText }}</div>
      </div>
    </div>

    <!-- Agent 执行过程面板 -->
    <section
      v-show="panelOpen"
      class="dev-mode__panel"
      data-testid="dev-console-panel"
      :style="{ '--panel-alpha': String(panelAlpha / 100) }"
    >
      <div class="dev-mode__panel-head">
        <span class="dev-mode__panel-title">{{ $t('devMode.panelTitle') }}</span>
        <label class="dev-mode__panel-alpha">
          {{ $t('devMode.panelAlpha') }}
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            :value="panelAlpha"
            data-testid="dev-console-alpha"
            @input="handleAlphaInput"
          />
        </label>
        <label class="dev-mode__panel-alpha">
          {{ $t('devMode.veilAlpha') }}
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            :value="veilAlpha"
            data-testid="dev-console-veil-alpha"
            @input="handleVeilAlphaInput"
          />
        </label>
        <button
          type="button"
          class="dev-mode__btn"
          data-testid="dev-console-refresh"
          @click="refreshRuns"
        >{{ $t('devMode.panelRefresh') }}</button>
        <button type="button" class="dev-mode__btn" @click="closePanel">{{ $t('devMode.panelCollapse') }}</button>
      </div>

      <div class="dev-mode__panel-body" data-testid="dev-console-panel-body">
        <div class="dev-mode__section">
          <div class="dev-mode__section-title">{{ $t('devMode.panelLatest') }}</div>
          <template v-if="detailRecord">
            <div class="dev-mode__kv">
              <span class="dev-mode__kv-key">{{ $t('devMode.panelPrompt') }}</span>
              <span class="dev-mode__kv-val">{{ detailRecord.prompt || $t('devMode.panelPromptEmpty') }}</span>
            </div>
            <div class="dev-mode__kv">
              <span class="dev-mode__kv-key">{{ $t('devMode.panelDuration') }}</span>
              <span class="dev-mode__kv-val">{{ formatDuration(detailRecord.duration) }}</span>
            </div>
            <div class="dev-mode__kv">
              <span class="dev-mode__kv-key">{{ $t('devMode.panelExitCode') }}</span>
              <span class="dev-mode__kv-val">{{ detailRecord.exitCode == null ? '—' : detailRecord.exitCode }}</span>
            </div>
            <div class="dev-mode__kv">
              <span class="dev-mode__kv-key">{{ $t('devMode.panelFinishedAt') }}</span>
              <span class="dev-mode__kv-val">{{ formatClock(detailRecord.finishedAt) }}</span>
            </div>
            <div v-if="detailRecord.error" class="dev-mode__kv">
              <span class="dev-mode__kv-key">{{ $t('devMode.panelError') }}</span>
              <span class="dev-mode__kv-val">{{ detailRecord.error }}</span>
            </div>
          </template>
          <div v-else class="dev-mode__muted">{{ $t('devMode.panelEmpty') }}</div>
        </div>

        <div v-if="detailRecord" class="dev-mode__section">
          <div class="dev-mode__section-title">
            {{ $t('devMode.panelFiles', { count: (detailRecord.files || []).length }) }}
          </div>
          <ul v-if="(detailRecord.files || []).length" class="dev-mode__files">
            <li v-for="(file, index) in detailRecord.files" :key="`${file.path}-${index}`" class="dev-mode__file">
              <span class="dev-mode__tag" :class="`dev-mode__tag--${statusInfo(file.status).key}`">
                {{ statusInfo(file.status).label }}
              </span>
              <span class="dev-mode__path">{{ file.path }}</span>
            </li>
          </ul>
          <div v-else class="dev-mode__muted">{{ $t('devMode.panelNoFiles') }}</div>
        </div>

        <div v-if="detailRecord" class="dev-mode__section">
          <div class="dev-mode__section-title">{{ $t('devMode.panelOutput') }}</div>
          <pre class="dev-mode__pre">{{ detailRecord.output || $t('devMode.panelNoContent') }}</pre>
        </div>

        <div v-if="detailRecord" class="dev-mode__section">
          <div class="dev-mode__section-title">{{ $t('devMode.panelReasoning') }}</div>
          <pre class="dev-mode__pre">{{ detailRecord.reasoningTail || $t('devMode.panelNoContent') }}</pre>
        </div>

        <div v-if="runs.length" class="dev-mode__section">
          <div class="dev-mode__section-title">{{ $t('devMode.panelHistory', { count: runs.length }) }}</div>
          <ul class="dev-mode__history">
            <li
              v-for="run in runs"
              :key="run.id"
              class="dev-mode__history-item"
              :class="{ 'dev-mode__history-item--active': String(run.id) === String(selectedRunId) }"
              @click="selectRun(run)"
            >
              <span class="dev-mode__mono">{{ formatClock(run.finishedAt) }}</span>
              <span class="dev-mode__history-prompt">{{ run.prompt || $t('devMode.noPrompt') }}</span>
              <span class="dev-mode__mono">
                {{ formatDuration(run.duration) }} · {{ $t('devMode.fileCount', { count: (run.files || []).length }) }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
export default {
  name: 'DevModeConsole',
}
</script>

<script lang="ts" setup>
// 1. 第三方依赖
import { MessagePlugin } from 'tdesign-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
// 2. 工程内工具
import { useI18n } from 'vue-i18n'
import router from '@/router'
import { useUserStore } from '@/stores/userStore'
import {
  type DevAgentChangedFile,
  type DevAgentCodeAccepted,
  type DevAgentReplyResult,
  type DevAgentRunRecord,
  type DevAgentRunResult,
  getDevAgentRuns,
  getDevAgentStatus,
  generateByDevAgent,
} from '@/api/devAgent'
import {
  type DevModeChannel,
  closeDevMode,
  devModeChannel,
  devModeDockOffset,
  devModeDraft,
  devModePanelAlpha,
  devModePanelOpen,
  devModeSpeak,
  devModeVeilAlpha,
  isDevModeAllowed,
  saveDevModeChannel,
  saveDevModeDockOffset,
  saveDevModeDraft,
  saveDevModePanelAlpha,
  saveDevModePanelOpen,
  saveDevModeSpeak,
  saveDevModeVeilAlpha,
} from '@/utils/devMode'
import { SphereMesh, drawWave, readLevel } from './controller/mesh'
import { SpeechController } from './controller/speech'
import { VoiceInput } from './controller/voice'

/**
 * 开发模式控制台（原生 Vue 组件）
 *
 * 界面本体从 ADMINSERVER/public/dev-agent-console.html 移植进来：
 * 球体神经网络 canvas、白色音轨、文字/语音切换、语音结果追加、可折叠的
 * 「Agent 执行过程」面板 + 透明度滑块、执行态球体消失只剩波纹、退出按钮。
 *
 * 与「独立页面」版本的区别：
 *   1) 只做一层整屏浅色幕布来区分（幕布 pointer-events: none，页面照常可点、看得清；
 *      浓度只留「淡淡一层」，面板头部可调）；
 *   2) 不再用 postMessage / window.open —— 完成后直接按菜单归一比对并 router.push；
 *   3) 状态全部持久化，刷新后自动恢复；挂载时请求 /status 与 /runs，
 *      若后端还有任务在跑就直接进入执行态并轮询到结束（Agent 不会被打断）。
 */

/**
 * 本次提交的任务最多等多久（毫秒）
 *
 * 「后台执行」通道提交后只轮询 5 分钟：这是交互上限，不是后端上限 ——
 * 超时就停止轮询并提示去「Agent 执行过程」面板看，避免无限转圈。
 */
const RUN_POLL_MAX_WAIT = 5 * 60 * 1000
/** 本次任务的轮询间隔（毫秒） */
const RUN_POLL_INTERVAL = 2500
/** 语音识别结束后自动发送的延迟（毫秒）：给识别结果落到输入框留一帧 */
const AUTO_SEND_DELAY = 320
/** 刷新后接管「后端还在跑的任务」时允许的最长等待（毫秒），Agent 不会被打断 */
const ADOPT_MAX_WAIT = 30 * 60 * 1000
/** 草稿落盘的防抖时间（毫秒） */
const DRAFT_SAVE_DELAY = 300
/** Agent 自身目录下的改动不参与页面跳转（归一化后的小写前缀） */
const AGENT_DIR_PREFIX = 'adminagent/'
/** 音轨位置允许的偏移范围（px） */
const DOCK_OFFSET_MIN = -180
const DOCK_OFFSET_MAX = 240

/** 菜单里的一个可跳转页面 */
interface MenuPage {
  /** 路由名（本项目路由就是 /组件名） */
  name: string
  /** 菜单配置的组件地址，形如 /src/pages/SystemOps/Log/index.vue */
  address: string
}

const { t, locale } = useI18n()
const userStore = useUserStore()

const meshRef = useTemplateRef<HTMLCanvasElement>('meshRef')
const waveRef = useTemplateRef<HTMLCanvasElement>('waveRef')
const stageRef = useTemplateRef<HTMLElement>('stageRef')
const inputRef = useTemplateRef<HTMLTextAreaElement>('inputRef')

/** 输入框内容（语音识别结果追加到这里，草稿持久化） */
const draft = ref<string>(devModeDraft.value)
/** 'text' | 'voice' */
const mode = ref<'text' | 'voice'>('text')
/** 临时识别结果（音轨上显示） */
const interim = ref('')
/** 识别服务的临时提示（空则回落成草稿预览） */
const speechNote = ref('')
/** dsh 是否就绪 */
const ready = ref(false)
/** 后端是否正在执行任务 */
const generating = ref(false)
/** 面板是否展开 */
const panelOpen = ref<boolean>(devModePanelOpen.value)
/** 面板背景透明度（0~100） */
const panelAlpha = ref<number>(devModePanelAlpha.value)
/** 整屏幕布浓度（0~100）：只要一层淡淡的幕布，系统页面必须看得清 */
const veilAlpha = ref<number>(devModeVeilAlpha.value)
/** 音轨位置（相对舞台底部的偏移 px） */
const dockOffset = ref<number>(devModeDockOffset.value)
/** 顶部状态栏文字与是否为错误态 */
const statusText = ref<string>(t('devMode.statusChecking'))
const statusError = ref(false)
/** 底部提示文字与是否为错误态 */
const hintText = ref<string>('')
const hintIsError = ref(false)
/** 最近一次结果 */
const lastResult = ref<DevAgentRunRecord | DevAgentRunResult | null>(null)
/** 结果卡片的错误态（本地错误，不是后端那次执行失败） */
const resultIsError = ref(false)
/** /runs 返回的历史 */
const runs = ref<DevAgentRunRecord[]>([])
/** 面板里选中的历史记录 */
const selectedRunId = ref<string | number | null>(null)
/** 结果卡片是否展示 */
const resultVisible = ref(false)
/** 当前通道：reply = 快速回复（TTS 播报）/ code = 后台执行 */
const channel = ref<DevModeChannel>(devModeChannel.value)
/** 是否语音播报（持久化） */
const speechMuted = ref<boolean>(!devModeSpeak.value)
/** 结果卡里展示的答复：快速回复通道的回答本来就不落历史，单独存一份 */
const resultAnswer = ref('')
/** 产生当前结果的通道（决定结果卡是「答复卡」还是「改动卡」） */
const resultChannel = ref<DevModeChannel>('reply')
/** 是否正在播报（界面上的轻微提示 + 球体轻微律动） */
const speaking = ref(false)
/** 是否已转入后台执行（「后台执行」通道提交后立刻为 true，不阻塞界面） */
const backgroundRunning = ref(false)

/** 球体画布控制器 */
let mesh: SphereMesh | null = null
/** 麦克风/语音识别控制器 */
let voice: VoiceInput | null = null
/** 语音播报（TTS）控制器 */
let speech: SpeechController | null = null
/** 帧循环句柄 */
let rafId = 0
/** 轮询定时器 */
let pollTimer = 0
/** 轮询到任务结束后的回调 */
let pollComplete: (() => void) | null = null
/** 开始等待后端任务的时间 */
let waitingSince = 0
/** 本次等待的上限（毫秒）：后台执行 5 分钟，接管刷新前的任务 30 分钟 */
let pollMaxWait = RUN_POLL_MAX_WAIT
/** 语音识别结果自动发送的定时器 */
let autoSendTimer = 0
/** 草稿落盘定时器 */
let draftTimer = 0
/** 是否已经挂载（避免卸载后 rAF / 定时器又跑起来） */
let mounted = false

const canSend = computed(
  () => ready.value && !generating.value && !backgroundRunning.value && !!draft.value.trim(),
)

/** 音轨/输入区的位置偏移（拖动把手调整，持久化） */
const dockTransform = computed(() => `translateY(${dockOffset.value}px)`)

/** 音轨上的文字：临时识别结果 > 识别服务提示 > 已识别草稿 */
const liveText = computed(() => {
  if (interim.value) return `${t('devMode.micResultPrefix')}${interim.value}`
  if (speechNote.value) return t(speechNote.value)
  const value = draft.value.trim()
  if (!value) return t('devMode.micWaiting')
  return t('devMode.micResultPrefix') + (value.length > 42 ? `${value.slice(0, 42)}…` : value)
})

/** 结果卡片标题 */
const resultHeadline = computed(() => {
  const record = lastResult.value
  if (resultIsError.value) {
    return t('devMode.resultError', { reason: (record as any)?.error || t('devMode.requestFailed') })
  }
  if (!record) return t('devMode.resultTitle')

  // 快速回复通道没有「退出码」的概念，只报通道 + 耗时
  if (resultChannel.value === 'reply') {
    return `${t('devMode.channelReply')} · ${t('devMode.resultBriefMeta', {
      duration: formatDuration(record.duration),
      time: formatClock(record.finishedAt),
    })}`
  }

  const head = record.ok ? t('devMode.resultDone') : t('devMode.resultEnded')
  return `${head} · ${t('devMode.resultMeta', {
    duration: formatDuration(record.duration),
    code: record.exitCode == null ? '—' : record.exitCode,
    time: formatClock(record.finishedAt),
  })}`
})

/** 结果卡片里的改动文件 */
const resultFiles = computed<DevAgentChangedFile[]>(() => {
  const record = lastResult.value
  return record && Array.isArray(record.files) ? record.files : []
})

/** 面板顶部展示的记录：本地结果与选中的历史里取更新的那次 */
const detailRecord = computed<DevAgentRunRecord | null>(() => {
  const history = runs.value
  let selected: DevAgentRunRecord | null = null
  for (const item of history) {
    if (String(item.id) === String(selectedRunId.value)) {
      selected = item
      break
    }
  }
  if (!selected) selected = history[0] || null

  const local = lastResult.value as DevAgentRunRecord | null
  if (local && (!selected || new Date(local.finishedAt || 0) >= new Date(selected.finishedAt || 0))) {
    return local
  }
  return selected
})

/**
 * Method Setting
 * 方法配置
 */

/** 毫秒 → 人类可读耗时 */
function formatDuration(ms: number | null | undefined): string {
  const value = Number(ms)
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value < 1000) return `${value}ms`
  if (value < 60000) return `${(value / 1000).toFixed(1)}s`
  return `${Math.floor(value / 60000)}m${Math.round((value % 60000) / 1000)}s`
}

/** ISO 时间 → 本地时分秒 */
function formatClock(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return '—'
  const pad = (n: number) => (n < 10 ? '0' : '') + n
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** git 状态码 → i18n 标签 + 样式后缀 */
function statusInfo(code: string | null | undefined): { label: string; key: string } {
  const value = String(code == null ? '' : code).trim().toUpperCase()
  if (value === 'M') return { label: t('devMode.fileStatus.modified'), key: 'modified' }
  if (value === 'A') return { label: t('devMode.fileStatus.added'), key: 'added' }
  if (value === 'D') return { label: t('devMode.fileStatus.deleted'), key: 'deleted' }
  if (value === 'R') return { label: t('devMode.fileStatus.renamed'), key: 'renamed' }
  if (value === '??' || value === '?') return { label: t('devMode.fileStatus.untracked'), key: 'untracked' }
  return { label: t('devMode.fileStatus.changed'), key: 'changed' }
}

function setHint(text: string, isError = false) {
  hintText.value = text || ''
  hintIsError.value = isError
}

function setStatus(text: string, isError = false) {
  statusText.value = text || ''
  statusError.value = isError
}

/**
 * 渲染一次结果（isError 只用于本地请求失败，后端那次失败仍按它的 ok 展示）
 *
 * @param record    后端返回的结果 / 历史记录
 * @param isError   是否是本地请求失败
 * @param owner     产生这条结果的通道（缺省沿用上一次的通道）
 * @param answer    快速回复通道的答复原文（历史记录里存在 output 里）
 */
function renderResult(
  record: DevAgentRunRecord | DevAgentRunResult | null,
  isError = false,
  owner?: DevModeChannel,
  answer = '',
) {
  lastResult.value = record
  resultIsError.value = isError
  resultVisible.value = !!record
  if (owner) resultChannel.value = owner
  resultAnswer.value = answer || ''
}

/** 关闭开发模式（只改状态开关，App.vue 会卸载本组件） */
function handleClose() {
  closeDevMode()
}

/**
 * Dock Setting
 * 音轨位置（拖动把手上下移动，位置持久化）
 */

let dockDragging = false
let dockStartY = 0
let dockStartOffset = 0
let dockMoved = false

function handleDockDragStart(event: PointerEvent) {
  if (event.button !== 0) return
  dockDragging = true
  dockMoved = false
  dockStartY = event.clientY
  dockStartOffset = dockOffset.value
  window.addEventListener('pointermove', handleDockDragMove)
  window.addEventListener('pointerup', handleDockDragEnd)
  window.addEventListener('pointercancel', handleDockDragEnd)
}

function handleDockDragMove(event: PointerEvent) {
  if (!dockDragging) return
  const dy = event.clientY - dockStartY
  if (!dockMoved && Math.abs(dy) < 3) return
  dockMoved = true
  event.preventDefault()
  dockOffset.value = Math.min(DOCK_OFFSET_MAX, Math.max(DOCK_OFFSET_MIN, dockStartOffset + dy))
}

function handleDockDragEnd() {
  if (!dockDragging) return
  dockDragging = false
  window.removeEventListener('pointermove', handleDockDragMove)
  window.removeEventListener('pointerup', handleDockDragEnd)
  window.removeEventListener('pointercancel', handleDockDragEnd)
  if (dockMoved) saveDevModeDockOffset(dockOffset.value)
}

/**
 * Panel Setting
 * 执行过程面板
 */

function openPanel() {
  panelOpen.value = true
  saveDevModePanelOpen(true)
  refreshRuns()
}

function closePanel() {
  panelOpen.value = false
  saveDevModePanelOpen(false)
}

function togglePanel() {
  if (panelOpen.value) closePanel()
  else openPanel()
}

function selectRun(run: DevAgentRunRecord) {
  selectedRunId.value = run.id
}

/** 面板背景透明度：滑块输入即写 localStorage */
function handleAlphaInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  panelAlpha.value = value
  saveDevModePanelAlpha(value)
}

/**
 * 幕布浓度：滑块输入即写 localStorage
 *
 * 往左拉 → 幕布更淡 → 底下的系统页面更清楚（0 = 完全没有幕布）。
 */
function handleVeilAlphaInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  veilAlpha.value = value
  saveDevModeVeilAlpha(value)
}

/**
 * Router Setting
 * 改动文件 → 菜单路由（同进程，不再走 postMessage）
 */

/** 路径归一化：统一分隔符、去掉开头 './'、转小写 */
function normalizePath(value: string): string {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .toLowerCase()
}

/** child 是否是 parent 的「整段路径后缀」 */
function isPathSuffix(child: string, parent: string): boolean {
  if (!parent || child.length <= parent.length || !child.endsWith(parent)) return false
  if (parent.startsWith('/')) return true
  return child.charAt(child.length - parent.length - 1) === '/'
}

/**
 * 后缀归一化比对：
 * 菜单 /src/pages/SystemOps/Log/index.vue ↔ 改动文件 ADMINCLIENT/src/pages/SystemOps/Log/index.vue
 */
function isSamePageFile(address: string, filePath: string): boolean {
  const menuPath = normalizePath(address)
  const changedPath = normalizePath(filePath)
  if (!menuPath || !changedPath) return false
  if (menuPath === changedPath) return true
  return isPathSuffix(changedPath, menuPath) || isPathSuffix(menuPath, changedPath)
}

/** 递归收集菜单树里所有「带组件地址」的页面 */
function collectMenuPages(): MenuPage[] {
  const pages: MenuPage[] = []

  const walk = (list: any[]) => {
    for (const item of list || []) {
      if (item?.component_address && item?.component_name) {
        pages.push({
          name: String(item.component_name),
          address: String(item.component_address),
        })
      }
      if (Array.isArray(item?.children) && item.children.length) walk(item.children)
    }
  }

  const menus = (userStore.userInfo as any)?.data?.menu_list
  walk(Array.isArray(menus) ? menus : [])
  return pages
}

/** 从改动文件里挑出要跳转的页面：命中多个时取第一个非 ADMINAGENT/ 的前端页面 */
function resolvePageRoute(files: DevAgentChangedFile[]): MenuPage | null {
  const pages = collectMenuPages()
  const hits: { page: MenuPage; path: string }[] = []

  for (const file of files) {
    const filePath = String(file?.path || '')
    if (!filePath) continue

    const hit = pages.find((page) => isSamePageFile(page.address, filePath))
    if (hit) hits.push({ page: hit, path: filePath })
  }

  const frontend = hits.find((item) => !normalizePath(item.path).startsWith(AGENT_DIR_PREFIX))
  return frontend ? frontend.page : null
}

/**
 * 每条完成记录只自动跳转一次
 *
 * 否则会出现死循环：跳转 -> 路由守卫发现未登录 -> 弹回登录页 -> 组件重新挂载
 * -> 又读到同一条完成记录 -> 再跳转……页面就会一直刷新。
 */
const NAVIGATED_RUN_KEY = 'dev-mode-navigated-run'

function markRunNavigated(runId: string | number) {
  try {
    localStorage.setItem(NAVIGATED_RUN_KEY, String(runId))
  } catch {
    /* 忽略 */
  }
}

function hasRunNavigated(runId: string | number) {
  try {
    return localStorage.getItem(NAVIGATED_RUN_KEY) === String(runId)
  } catch {
    return false
  }
}

/** 任务完成后：把被改动的文件映射成菜单路由并跳过去 */
function jumpToChangedPage(files: DevAgentChangedFile[], runId?: string | number | null) {
  const list = Array.isArray(files) ? files : []
  if (!list.length) return

  // 未登录（或已被守卫弹回登录页）时不要再跳，否则会和路由守卫来回打架
  if (!isDevModeAllowed()) {
    closeDevMode()
    return
  }

  const hasRunId = runId !== undefined && runId !== null
  if (hasRunId && hasRunNavigated(runId as string | number)) return

  const target = resolvePageRoute(list)
  if (!target) {
    // 改动不在任何菜单页面上（例如只改了后端），保持当前页面
    MessagePlugin.info(t('devMode.appliedNoMatch'))
    return
  }

  // 先记账再跳：即使这次跳转被守卫拦下，也不会再重复跳（防死循环）
  if (hasRunId) markRunNavigated(runId as string | number)

  MessagePlugin.success(t('devMode.appliedJump', { name: target.name }))
  router.push(`/${target.name}`)
}

/**
 * Task Setting
 * 任务执行 + 刷新后自动接回
 */

/** 停止轮询（卸载、任务结束、重新提交都会调用） */
function stopPolling() {
  if (pollTimer) {
    window.clearTimeout(pollTimer)
    pollTimer = 0
  }
}

function enterBusy(hintKey: string) {
  generating.value = true
  resultVisible.value = false
  setHint(t(hintKey))
}

function stopBusy() {
  generating.value = false
  backgroundRunning.value = false
}

/** 后台执行通道：立刻受理，只留提示，不阻塞提交动作 */
function enterBackground(hintKey: string) {
  generating.value = true
  backgroundRunning.value = true
  resultVisible.value = false
  setHint(t(hintKey))
}

function applyRunsData(data: { items?: DevAgentRunRecord[] } | null | undefined) {
  runs.value = Array.isArray(data?.items) ? data.items : []
}

/** 拉一次执行历史（面板用；失败不打断主流程） */
function refreshRuns(): Promise<void> {
  return getDevAgentRuns()
    .then((data) => {
      applyRunsData(data)
      if (data?.running && !generating.value) setHint(t('devMode.runningBackend'))
    })
    .catch(() => {
      /* 忽略 */
    })
}

/** 从最近一次 /runs 结果里找出这次提交的那条记录 */
function localRecordOf(runId: string | number | null): DevAgentRunRecord | null {
  if (runId != null) {
    for (const item of runs.value) {
      if (String(item.id) === String(runId)) return item
    }
  }
  return runs.value[0] ?? null
}

/** 这条记录是否还在跑（/runs 里该条 running 已翻成 false 就算完成） */
function isRecordRunning(record: DevAgentRunRecord | null): boolean {
  return !!record && record.running !== false
}

/** 一条 record 是简短回复通道的答复记录（答复存在 output 里） */
function recordChannel(record: DevAgentRunRecord | null): DevModeChannel | null {
  if (!record) return null
  if (record.channel === 'reply' || record.channel === 'code') return record.channel
  return null
}

/**
 * 轮询 /runs 直到这次任务结束，然后展示结果、改动文件并跳转
 *
 * @param runId   这次提交的 runId（null = 只等「后端不再有任务在跑」）
 * @param adopted 是否是刷新后接管的任务（接管用 30 分钟上限，本次提交用 5 分钟）
 */
function pollUntilRunDone(runId: string | number | null, adopted = false) {
  stopPolling()
  waitingSince = Date.now()
  pollMaxWait = adopted ? ADOPT_MAX_WAIT : RUN_POLL_MAX_WAIT

  const poll = () => {
    pollTimer = 0
    if (!mounted) return

    getDevAgentRuns()
      .then((data) => {
        applyRunsData(data)

        const current = localRecordOf(runId)
        const pending = isRecordRunning(current) || (adopted && !!data?.running)
        if (pending) {
          if (Date.now() - waitingSince >= pollMaxWait) {
            // 本次提交超过上限：停止轮询并提示去面板看，避免无限转圈
            stopBusy()
            setHint(t('devMode.backgroundTimeout'), true)
            const timeoutCallback = pollComplete
            pollComplete = null
            if (timeoutCallback) timeoutCallback()
            return
          }
          pollTimer = window.setTimeout(poll, RUN_POLL_INTERVAL)
          return
        }

        const finished = current
        stopBusy()
        if (finished) {
          const channelOfRun = recordChannel(finished)
          lastResult.value = finished
          selectedRunId.value = finished.id
          renderResult(
            finished,
            false,
            channelOfRun || undefined,
            channelOfRun === 'reply' ? finished.output || '' : '',
          )
          setHint(
            finished.ok
              ? t(adopted ? 'devMode.doneHintLocal' : 'devMode.backgroundDoneHint')
              : t('devMode.doneFailed', {
                  reason: finished.error || t('devMode.exitCodeLabel', { code: finished.exitCode }),
                }),
          )
          if (channelOfRun !== 'reply') jumpToChangedPage(finished.files || [], runId)
        } else {
          setHint(t('devMode.taskEnded'))
        }

        const callback = pollComplete
        pollComplete = null
        if (callback) callback()
      })
      .catch(() => {
        // 网络抖动继续重试，不打断轮询
        pollTimer = window.setTimeout(poll, RUN_POLL_INTERVAL)
      })
  }

  poll()
}

/** 接管「后端还在跑」的任务：进入执行态并轮询到它结束（Agent 不会被打断） */
function adoptRunning(record: DevAgentRunRecord | DevAgentRunResult | null) {
  if (generating.value) return

  enterBusy('devMode.runningWait')
  const runRecord = record as DevAgentRunRecord | null
  if (runRecord) {
    lastResult.value = runRecord
    selectedRunId.value = runRecord.id ?? null
    if (runRecord.prompt && !draft.value) draft.value = runRecord.prompt
  }

  pollComplete = () => {
    stopBusy()
    refreshRuns()
  }

  pollUntilRunDone(runRecord?.id ?? null, true)
}

/** 挂载/刷新时恢复上下文：还在跑就接回执行态，否则展示最近一次结果 */
function syncComposer(statusData: { running?: boolean; lastRun?: DevAgentRunResult | null } | null | undefined) {
  if (statusData?.running) {
    adoptRunning(null)
    return
  }

  const last = statusData?.lastRun || null
  if (last) {
    lastResult.value = last
    renderResult(last, false)
    setHint(
      last.ok
        ? t('devMode.lastDone')
        : t('devMode.lastFailed', { reason: last.error || t('devMode.exitCodeLabel', { code: last.exitCode }) }),
    )
    return
  }

  getDevAgentRuns()
    .then((data) => {
      applyRunsData(data)
      if (data?.running) {
        adoptRunning(runs.value[0] || null)
        return
      }
      if (runs.value.length) {
        const latest = runs.value[0] ?? null
        if (!latest) return
        const channelOfRun = recordChannel(latest)
        lastResult.value = latest
        selectedRunId.value = latest.id
        renderResult(latest, false, channelOfRun || undefined, channelOfRun === 'reply' ? latest.output || '' : '')
        setHint(t('devMode.historyRestored'))
      }
    })
    .catch(() => {
      /* 忽略：历史拉取失败不影响输入 */
    })
}

/** 读取运行环境状态（dsh 是否就绪 + 最近一次结果 + 是否正在跑） */
function loadStatus() {
  getDevAgentStatus()
    .then((data) => {
      ready.value = !!data?.ready
      if (ready.value) {
        setStatus(t('devMode.readyStatus', { cwd: data?.cwd || '—' }))
        setHint(t('devMode.readyHint'))
      } else {
        const reason = data?.hint || t('devMode.notReadyHint')
        setStatus(reason, true)
        setHint(reason, true)
      }
      syncComposer(data || {})
    })
    .catch((error: any) => {
      ready.value = false
      const message = error?.message || t('devMode.statusFailed')
      setStatus(message, true)
      setHint(message, true)

      // 连 /status 都拿不到（token 失效、被踢回登录页、后端没起来……）说明开发模式此刻毫无用处。
      // 更关键的是：不关会陷入死循环 —— 请求 401 → 拦截器 removeItem + location.href='/login'
      // → 路由守卫认为"有 token 就是已登录"又弹回首页 → 组件重新挂载 → 再请求……
      // 所以这里直接收起，用户重新登录后再打开即可。
      closeDevMode()
    })
}

/**
 * Composer Setting
 * 输入 / 语音 / 发送
 */

/** Enter 发送，Shift + Enter 换行 */
function handleInputKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  handleGenerate()
}

/**
 * Channel Setting
 * 通道切换（快速回复 / 后台执行），选择持久化
 */

/** 切换通道：切走时掐掉正在念的语音，避免跨通道叠着播报 */
function switchChannel(next: DevModeChannel) {
  if (next === channel.value) return
  if (next === 'code') {
    speech?.cancel()
    cancelAutoSend()
  }
  channel.value = next
  saveDevModeChannel(next)
  setHint(t(next === 'reply' ? 'devMode.readyHint' : 'devMode.channelCodeTip'))
}

/**
 * Speech Setting
 * 语音播报（TTS）
 *
 * 浏览器不支持 speechSynthesis 时静默降级：只走结果卡里的文字，不报错。
 */

/** 静音开关：关掉时立刻停止正在念的内容，并且之后不再调用 speak */
function handleToggleMute() {
  speechMuted.value = !speechMuted.value
  saveDevModeSpeak(!speechMuted.value)
  if (speechMuted.value) speech?.cancel()
  setHint(t(speechMuted.value ? 'devMode.speakOff' : 'devMode.speakOn'))
}

/** 念一句（静音、浏览器不支持、组件已卸载都自动跳过，只在结果卡显示文字） */
function speakAnswer(answer: string) {
  const content = String(answer || '').trim()
  if (!content || !mounted) return
  if (!speech?.supported) return
  speech.speak(content)
}

/**
 * Voice Setting
 * 语音识别 → 自动发送 → 自动播报（只在快速回复通道）
 */

/** 语音识别的确定结果「追加」到输入框 */
function appendRecognized(text: string) {
  const value = String(text || '').trim()
  if (!value) return

  let existing = draft.value
  if (existing && !/[\s，。；、,.;]$/.test(existing)) existing += ' '
  draft.value = existing + value
  interim.value = ''
  speechNote.value = ''
  saveDraftNow()
  scheduleAutoSend()
}

/** 快速回复通道下的「说一句 → 听回答」闭环：识别完就自动发送 */
function shouldAutoSendByVoice(): boolean {
  return channel.value === 'reply' && !!ready.value && !generating.value && !backgroundRunning.value
}

/** 等识别结果落到输入框后再自动发送（文字输入不触发） */
function scheduleAutoSend() {
  cancelAutoSend()
  if (!shouldAutoSendByVoice()) return
  autoSendTimer = window.setTimeout(() => {
    autoSendTimer = 0
    if (!mounted || !shouldAutoSendByVoice()) return
    if (!draft.value.trim()) return
    handleGenerate()
  }, AUTO_SEND_DELAY)
}

/** 放弃待执行的自动发送（切通道、退出语音模式、卸载） */
function cancelAutoSend() {
  if (autoSendTimer) {
    window.clearTimeout(autoSendTimer)
    autoSendTimer = 0
  }
}

/** 切到文字模式后把焦点放回输入框 */
function focusInput() {
  nextTick(() => inputRef.value?.focus())
}

/** 进入语音模式：先把 UI 切到音轨形态，再申请麦克风 */
function enterVoiceMode() {
  mode.value = 'voice'
  interim.value = ''
  speechNote.value = ''
  setHint(t('devMode.micRequesting'))
  voice?.start().catch(() => {
    // 兜底：任何麦克风异常都只提示，不允许未捕获异常
    setHint(t('devMode.audioFailed'), true)
    fallbackToText()
  })
}

/** 退出语音模式 */
function exitVoiceMode(hintKey?: string) {
  mode.value = 'text'
  interim.value = ''
  speechNote.value = ''
  cancelAutoSend()
  voice?.stop()
  if (hintKey) setHint(t(hintKey))
}

/** 麦克风/识别不可用时自动退回文字输入 */
function fallbackToText() {
  if (mode.value === 'voice') exitVoiceMode('devMode.fallbackToText')
}

function handleToggleMode() {
  if (mode.value === 'voice') {
    exitVoiceMode('devMode.switchedToText')
    focusInput()
    return
  }
  enterVoiceMode()
}

/** 草稿落盘（防抖，避免每敲一个字都写 localStorage） */
function saveDraftNow() {
  if (draftTimer) {
    window.clearTimeout(draftTimer)
    draftTimer = 0
  }
  saveDevModeDraft(draft.value)
}

watch(draft, () => {
  if (draftTimer) window.clearTimeout(draftTimer)
  draftTimer = window.setTimeout(() => {
    draftTimer = 0
    saveDevModeDraft(draft.value)
  }, DRAFT_SAVE_DELAY)
})

/** 语言切换后播报语言跟着切（zh-CN / en-US） */
watch(locale, (value) => {
  speech?.setLang(String(value || 'zh-CN'))
})

/**
 * 提交任务
 *
 * - 快速回复：同步等答复 → 结果卡显示一两句 → TTS 念出来（不改代码、不跳页面）
 * - 后台执行：立刻受理 → 只提示「已转入后台执行」→ 轮询 /runs 到 running 翻成 false
 */
async function handleGenerate() {
  if (generating.value || backgroundRunning.value) return

  const prompt = draft.value.trim()
  if (!prompt) {
    setHint(t('devMode.emptyPrompt'), true)
    return
  }
  if (!ready.value) {
    setHint(t('devMode.notReady'), true)
    return
  }

  // 再次发送前掐掉上一段播报与待执行的自动发送，避免叠着念 / 重复提交
  cancelAutoSend()
  speech?.cancel()

  // 提交时收回麦克风：避免把环境音当成新的需求
  if (mode.value === 'voice') {
    voice?.suspend()
    interim.value = ''
  }

  if (channel.value === 'reply') await runReply(prompt)
  else await runBackground(prompt)

  refreshRuns()
}

/** 快速回复通道：同步拿答复 → 展示 + 播报 */
async function runReply(prompt: string) {
  enterBusy('devMode.runningHint')

  try {
    const accepted = (await generateByDevAgent(prompt, 'reply')) as DevAgentReplyResult
    const answer = String(accepted?.answer || '')
    const record: DevAgentRunResult = {
      ok: !!accepted?.ok,
      exitCode: accepted?.exitCode ?? null,
      duration: Number(accepted?.duration) || 0,
      output: answer,
      reasoningTail: '',
      files: Array.isArray(accepted?.files) ? accepted.files : [],
      finishedAt: accepted?.finishedAt || new Date().toISOString(),
      answer,
    }
    selectedRunId.value = null
    renderResult(record, false, 'reply', answer)
    // 答复在结果卡里最多显示几行，播报才是完整内容
    speakAnswer(answer)
    setHint(record.ok ? t('devMode.speakOn') : t('devMode.backgroundDoneHint'))
    if (record.ok) {
      draft.value = ''
      saveDraftNow()
    }
  } catch (error: any) {
    // 超时/网络抖动时后端可能还在跑：先接回执行态，而不是直接报失败
    try {
      const status = await getDevAgentStatus()
      if (status?.running) {
        stopBusy()
        adoptRunning(null)
        return
      }
    } catch {
      /* 忽略：状态也拿不到就按失败处理 */
    }

    const message = error?.message || t('devMode.requestFailed')
    renderResult(
      {
        ok: false,
        exitCode: null,
        duration: 0,
        output: '',
        reasoningTail: '',
        files: [],
        finishedAt: new Date().toISOString(),
        error: message,
      },
      true,
      'reply',
    )
    setHint(t('devMode.generateFailed'), true)
  } finally {
    if (generating.value && !pollTimer) stopBusy()
  }
}

/** 后台执行通道：立刻表示已受理，然后轮询到结束 */
async function runBackground(prompt: string) {
  try {
    const accepted = (await generateByDevAgent(prompt, 'code')) as DevAgentCodeAccepted

    // 立刻表示「已转入后台执行」：绝不在界面上等它跑完
    enterBackground('devMode.backgroundAccepted')
    selectedRunId.value = accepted?.runId ?? null
    pollComplete = () => {
      stopBusy()
      refreshRuns()
    }
    pollUntilRunDone(accepted?.runId ?? null)

    draft.value = ''
    saveDraftNow()
  } catch (error: any) {
    stopBusy()
    const message = error?.message || t('devMode.requestFailed')
    renderResult(
      {
        ok: false,
        exitCode: null,
        duration: 0,
        output: '',
        reasoningTail: '',
        files: [],
        finishedAt: new Date().toISOString(),
        error: message,
      },
      true,
      'code',
    )
    setHint(t('devMode.generateFailed'), true)
  } finally {
    // 这里刻意不再兜底 stopBusy()：后台通道提交成功后要一直保持执行态，
    // 直到轮询发现 running 翻成 false（否则「已转入后台执行」会被立刻复位）。
    refreshRuns()
  }
}

/**
 * Canvas / Frame Setting
 * 球体与音轨
 */

function tick() {
  rafId = 0
  if (document.hidden || !mounted) return

  rafId = window.requestAnimationFrame(tick)
  const now = performance.now()
  let level = readLevel(voice?.node ?? null, voice?.data ?? null)
  // 播报时给球体一点轻微律动（很收敛，不做夸张效果）
  if (speaking.value) level = Math.max(level, 0.22 + 0.1 * Math.sin(now / 320))

  mesh?.frame(now, level, generating.value)
  if (mode.value === 'voice' && waveRef.value) {
    drawWave(waveRef.value, voice?.node ?? null, voice?.data ?? null)
  }
}

function startLoop() {
  if (!rafId && mounted) rafId = window.requestAnimationFrame(tick)
}

/** 舞台尺寸变化时重新量一次（球心/半径跟着窗口走） */
function measure() {
  mesh?.measure(stageRef.value)
  if (mode.value === 'voice' && waveRef.value) {
    drawWave(waveRef.value, voice?.node ?? null, voice?.data ?? null)
  }
}

/** 切到后台就停掉帧循环，回来再继续 */
function handleVisibility() {
  if (!mounted) return
  if (document.hidden) {
    if (rafId) {
      window.cancelAnimationFrame(rafId)
      rafId = 0
    }
    return
  }
  startLoop()
}

/**
 * 只要路由落到登录页，立刻收起开发模式（**不看 token**）
 *
 * 这是「页面一直刷新」的根因防线：token 过期/失效时，请求拦截器会
 * `localStorage.removeItem('token')` 然后 `window.location.href = '/login'` 整页跳转；
 * 而 dev-mode-open 还在 localStorage 里，开发模式每次都跟着应用重新挂载、
 * 又去请求 /dev-agent/status 拿 401、再被踢回登录页 —— 于是无限刷新。
 * 所以这里必须无条件关掉：登录页上根本不该有开发模式。
 * immediate: true 让它在组件 setup 阶段就先判一次，避免先发请求再关闭。
 */
watch(
  () => router.currentRoute.value.path,
  (path) => {
    if (path === '/login') closeDevMode()
  },
  { immediate: true },
)

/**
 * Lifecycle
 * 生命周期
 */

onMounted(() => {
  mounted = true

  // 登录页不启动；未登录（本地没有 token）也不启动
  if (router.currentRoute.value.path === '/login' || !isDevModeAllowed()) {
    closeDevMode()
    mounted = false
    return
  }

  if (meshRef.value) mesh = new SphereMesh(meshRef.value)
  voice = new VoiceInput({
    onFinalText: (text) => appendRecognized(text),
    onInterimText: (text) => {
      interim.value = text
    },
    onHint: (key, isError) => {
      speechNote.value = key
      setHint(t(key), isError)
    },
    onFallback: (key) => {
      speechNote.value = key
      exitVoiceMode()
    },
  })

  // 语音播报：不支持 speechSynthesis 的浏览器静默降级（只在结果卡显示文字）
  speech = new SpeechController(
    {
      canSpeak: () => !speechMuted.value && mounted,
      onStart: () => {
        speaking.value = true
      },
      onEnd: () => {
        speaking.value = false
      },
    },
    String(locale.value || 'zh-CN'),
  )

  measure()
  startLoop()
  window.addEventListener('resize', measure)
  document.addEventListener('visibilitychange', handleVisibility)

  // 刷新/重开后自动接回后端状态（包含正在跑的任务）
  loadStatus()
  refreshRuns()
})

onBeforeUnmount(() => {
  mounted = false
  window.removeEventListener('resize', measure)
  document.removeEventListener('visibilitychange', handleVisibility)
  handleDockDragEnd()
  stopPolling()
  cancelAutoSend()
  // 卸载/退出开发模式：正在念的语音必须立刻停掉，不能留在后台
  speech?.dispose()
  speech = null
  speaking.value = false
  if (rafId) {
    window.cancelAnimationFrame(rafId)
    rafId = 0
  }
  if (draftTimer) {
    window.clearTimeout(draftTimer)
    draftTimer = 0
  }
  saveDevModeDraft(draft.value)
  voice?.stop()
  voice = null
  mesh = null
})
</script>

<style lang="scss" scoped>@import url("./index.scss");</style>

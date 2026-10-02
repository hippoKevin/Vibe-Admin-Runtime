import { ref } from 'vue'

/**
 * 开发模式状态（单一状态源，全部持久化到 localStorage）
 *
 * 开发模式的界面本体是应用内的 Vue 组件（见 components/DevModeConsole），
 * 挂载点固定在 App.vue —— 页面级热更新不会把它卸载。这里保存的状态会在
 * Vite 整页刷新后自动恢复：开关、输入草稿、面板展开、面板透明度、幕布浓度、音轨位置。
 * 真正的任务状态在后端进程里（running + 最近 20 次历史），刷新只影响前端表现。
 */

/** 开发模式的两个通道：reply = 快速回复（TTS 播报），code = 后台执行改代码 */
export type DevModeChannel = 'reply' | 'code'

/** 开发模式是否打开 */
export const DEV_MODE_OPEN_KEY = 'dev-mode-open'

/** 当前通道（快速回复 / 后台执行） */
export const DEV_MODE_CHANNEL_KEY = 'dev-mode-channel'

/** 是否语音播报（快速回复通道的答复用 TTS 念出来） */
export const DEV_MODE_SPEAK_KEY = 'dev-mode-speak'

/** 输入框草稿（刷新后不丢输入） */
export const DEV_MODE_DRAFT_KEY = 'dev-mode-draft'

/** 「Agent 执行过程」面板是否展开 */
export const DEV_MODE_PANEL_KEY = 'dev-mode-panel-open'

/** 面板背景透明度（0~100） */
export const DEV_MODE_ALPHA_KEY = 'dev-mode-panel-alpha'

/** 整屏幕布浓度（0~100）：幕布白色的占比，越低越能看清底下的系统页面 */
export const DEV_MODE_VEIL_ALPHA_KEY = 'dev-mode-veil-alpha'

/** 底部输入区（音轨）位置：相对舞台底部的偏移，拖动后保持 */
export const DEV_MODE_DOCK_KEY = 'dev-mode-dock-pos'

/** DSH profile（面板上的「模式」下拉框） */
export const DEV_MODE_PROFILE_KEY = 'dev-mode-profile'

/** 当前会话 id（DSH sessionId）：带上它就是接着这条会话继续追问 */
export const DEV_MODE_SESSION_KEY = 'dev-mode-session-id'

/**
 * 是否「自动跟随 Agent 跳转」
 *
 * 开（默认）：Agent 运行期间每改到一个前端文件，界面就跳到那个文件对应的页面；
 * 关：退回旧行为 —— 只在任务结束后按最终改动列表跳一次。
 */
export const DEV_MODE_FOLLOW_KEY = 'dev-mode-follow-jump'

/** 面板透明度默认值（%） */
export const PANEL_ALPHA_DEFAULT = 86

/** 默认 DSH profile：与后端 dev-agent.service 的 DEFAULT_PROFILE 保持一致 */
export const DEV_MODE_PROFILE_DEFAULT = 'headless'

/**
 * 幕布浓度默认值（%）
 *
 * 只要一层「淡淡的幕布」：整屏压一层极浅的白，系统页面照常看得清、读得懂。
 * 历史上这里是 72% + blur(4px)，等于把系统糊掉了，所以默认值降到 18%。
 */
export const VEIL_ALPHA_DEFAULT = 18

/** 开发模式默认通道：快速回复（说一句 → 听回答） */
export const DEV_MODE_CHANNEL_DEFAULT: DevModeChannel = 'reply'

/** 音轨位置默认值（相对舞台底部的像素偏移） */
export const DOCK_OFFSET_DEFAULT = 0

/** 音轨位置允许的偏移范围（px） */
const DOCK_OFFSET_MIN = -180
const DOCK_OFFSET_MAX = 240

/** 读音（写值失败时静默：隐私模式下 localStorage 不可写） */
function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return raw === '1'
  } catch {
    return fallback
  }
}

function writeBoolean(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* 忽略 */
  }
}

function readString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function writeString(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 忽略 */
  }
}

function readNumber(key: string, fallback: number, min: number, max: number): number {
  const value = Number(readString(key, String(fallback)))
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function writeNumber(key: string, value: number) {
  writeString(key, String(value))
}

/** 读音道（非法值一律回落到默认的「快速回复」） */
function readChannel(key: string, fallback: DevModeChannel): DevModeChannel {
  const value = readString(key, fallback)
  return value === 'code' || value === 'reply' ? value : fallback
}

/** 是否已登录：开发模式要调后端接口，未登录时不该打开 */
export function isDevModeAllowed(): boolean {
  try {
    return Boolean(localStorage.getItem('token'))
  } catch {
    return false
  }
}

/** 开发模式是否打开：只在上次是打开的「且已登录」时才恢复 */
export const devModeOpen = ref<boolean>(readBoolean(DEV_MODE_OPEN_KEY, false) && isDevModeAllowed())

/** 输入草稿 */
export const devModeDraft = ref<string>(readString(DEV_MODE_DRAFT_KEY, ''))

/** 面板是否展开 */
export const devModePanelOpen = ref<boolean>(readBoolean(DEV_MODE_PANEL_KEY, false))

/** 面板背景透明度（%） */
export const devModePanelAlpha = ref<number>(
  readNumber(DEV_MODE_ALPHA_KEY, PANEL_ALPHA_DEFAULT, 0, 100),
)

/** 整屏幕布浓度（%） */
export const devModeVeilAlpha = ref<number>(
  readNumber(DEV_MODE_VEIL_ALPHA_KEY, VEIL_ALPHA_DEFAULT, 0, 100),
)

/** 音轨位置（相对舞台底部的偏移 px，正数 = 往下） */
export const devModeDockOffset = ref<number>(
  readNumber(DEV_MODE_DOCK_KEY, DOCK_OFFSET_DEFAULT, DOCK_OFFSET_MIN, DOCK_OFFSET_MAX),
)

/** 当前通道：reply = 快速回复（TTS 播报）/ code = 后台执行 */
export const devModeChannel = ref<DevModeChannel>(readChannel(DEV_MODE_CHANNEL_KEY, DEV_MODE_CHANNEL_DEFAULT))

/** 是否语音播报（快速回复通道的答复用 TTS 念出来） */
export const devModeSpeak = ref<boolean>(readBoolean(DEV_MODE_SPEAK_KEY, true))

/** 当前 DSH profile（「模式」下拉框的选中值） */
export const devModeProfile = ref<string>(readString(DEV_MODE_PROFILE_KEY, DEV_MODE_PROFILE_DEFAULT))

/** 当前会话 id（空字符串 = 新对话，下次提交不带 sessionId） */
export const devModeSessionId = ref<string>(readString(DEV_MODE_SESSION_KEY, ''))

/** 是否自动跟随 Agent 跳转（默认开：运行中改到哪个前端文件就跳到哪个页面） */
export const devModeFollowJump = ref<boolean>(readBoolean(DEV_MODE_FOLLOW_KEY, true))

/** 打开开发模式（未登录时不开；持久化，刷新后自动恢复） */
export function openDevMode() {
  if (!isDevModeAllowed()) return false
  devModeOpen.value = true
  writeBoolean(DEV_MODE_OPEN_KEY, true)
  return true
}

/** 关闭开发模式 */
export function closeDevMode() {
  devModeOpen.value = false
  writeBoolean(DEV_MODE_OPEN_KEY, false)
}

/**
 * 登录态没了就收起开发模式
 *
 * 场景：未登录时开发模式还开着，路由守卫会把页面弹回登录页，
 * 而开发模式如果继续动作（例如按完成记录跳转）就会和守卫来回打架、页面不停刷新。
 */
export function closeDevModeIfUnauthenticated(): boolean {
  if (isDevModeAllowed()) return false
  closeDevMode()
  return true
}

/**
 * 切换开发模式
 * @returns 切换后的状态（true = 已打开）
 */
export function toggleDevMode(): boolean {
  if (devModeOpen.value) {
    closeDevMode()
    return false
  }
  openDevMode()
  return true
}

/** 保存输入草稿 */
export function saveDevModeDraft(value: string) {
  devModeDraft.value = value
  writeString(DEV_MODE_DRAFT_KEY, value)
}

/** 保存面板展开状态 */
export function saveDevModePanelOpen(value: boolean) {
  devModePanelOpen.value = value
  writeBoolean(DEV_MODE_PANEL_KEY, value)
}

/** 保存面板透明度（%） */
export function saveDevModePanelAlpha(value: number) {
  const next = Math.min(100, Math.max(0, Math.round(Number(value) || 0)))
  devModePanelAlpha.value = next
  writeNumber(DEV_MODE_ALPHA_KEY, next)
}

/** 保存幕布浓度（%） */
export function saveDevModeVeilAlpha(value: number) {
  const next = Math.min(100, Math.max(0, Math.round(Number(value) || 0)))
  devModeVeilAlpha.value = next
  writeNumber(DEV_MODE_VEIL_ALPHA_KEY, next)
}

/** 保存音轨位置（相对舞台底部的偏移 px） */
export function saveDevModeDockOffset(value: number) {
  const next = Math.min(DOCK_OFFSET_MAX, Math.max(DOCK_OFFSET_MIN, Math.round(Number(value) || 0)))
  devModeDockOffset.value = next
  writeNumber(DEV_MODE_DOCK_KEY, next)
}

/** 保存当前通道（刷新后保持） */
export function saveDevModeChannel(value: DevModeChannel) {
  const next: DevModeChannel = value === 'code' ? 'code' : 'reply'
  devModeChannel.value = next
  writeString(DEV_MODE_CHANNEL_KEY, next)
}

/** 保存是否语音播报 */
export function saveDevModeSpeak(value: boolean) {
  devModeSpeak.value = value
  writeBoolean(DEV_MODE_SPEAK_KEY, value)
}

/** 保存当前 DSH profile（「模式」下拉框） */
export function saveDevModeProfile(value: string) {
  const next = String(value || '').trim() || DEV_MODE_PROFILE_DEFAULT
  devModeProfile.value = next
  writeString(DEV_MODE_PROFILE_KEY, next)
}

/** 保存当前会话 id（传空字符串 = 清空，开始新对话） */
export function saveDevModeSessionId(value: string) {
  const next = String(value || '').trim()
  devModeSessionId.value = next
  writeString(DEV_MODE_SESSION_KEY, next)
}

/** 保存是否自动跟随 Agent 跳转 */
export function saveDevModeFollowJump(value: boolean) {
  devModeFollowJump.value = value
  writeBoolean(DEV_MODE_FOLLOW_KEY, value)
}

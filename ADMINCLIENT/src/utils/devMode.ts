import { ref } from 'vue'

/**
 * 开发模式状态（单一状态源，全部持久化到 localStorage）
 *
 * 开发模式的界面本体是应用内的 Vue 组件（见 components/DevModeConsole），
 * 挂载点固定在 App.vue —— 页面级热更新不会把它卸载。这里保存的状态会在
 * Vite 整页刷新后自动恢复：开关、输入草稿、面板展开、面板透明度、音轨位置。
 * 真正的任务状态在后端进程里（running + 最近 20 次历史），刷新只影响前端表现。
 */

/** 开发模式是否打开 */
export const DEV_MODE_OPEN_KEY = 'dev-mode-open'

/** 输入框草稿（刷新后不丢输入） */
export const DEV_MODE_DRAFT_KEY = 'dev-mode-draft'

/** 「Agent 执行过程」面板是否展开 */
export const DEV_MODE_PANEL_KEY = 'dev-mode-panel-open'

/** 面板背景透明度（0~100） */
export const DEV_MODE_ALPHA_KEY = 'dev-mode-panel-alpha'

/** 底部输入区（音轨）位置：相对舞台底部的偏移，拖动后保持 */
export const DEV_MODE_DOCK_KEY = 'dev-mode-dock-pos'

/** 面板透明度默认值（%） */
export const PANEL_ALPHA_DEFAULT = 86

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

/** 开发模式是否打开：应用启动时若上次是打开的，直接恢复 */
export const devModeOpen = ref<boolean>(readBoolean(DEV_MODE_OPEN_KEY, false))

/** 输入草稿 */
export const devModeDraft = ref<string>(readString(DEV_MODE_DRAFT_KEY, ''))

/** 面板是否展开 */
export const devModePanelOpen = ref<boolean>(readBoolean(DEV_MODE_PANEL_KEY, false))

/** 面板背景透明度（%） */
export const devModePanelAlpha = ref<number>(
  readNumber(DEV_MODE_ALPHA_KEY, PANEL_ALPHA_DEFAULT, 0, 100),
)

/** 音轨位置（相对舞台底部的偏移 px，正数 = 往下） */
export const devModeDockOffset = ref<number>(
  readNumber(DEV_MODE_DOCK_KEY, DOCK_OFFSET_DEFAULT, DOCK_OFFSET_MIN, DOCK_OFFSET_MAX),
)

/** 打开开发模式（持久化，刷新后自动恢复） */
export function openDevMode() {
  devModeOpen.value = true
  writeBoolean(DEV_MODE_OPEN_KEY, true)
}

/** 关闭开发模式 */
export function closeDevMode() {
  devModeOpen.value = false
  writeBoolean(DEV_MODE_OPEN_KEY, false)
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

/** 保存音轨位置（相对舞台底部的偏移 px） */
export function saveDevModeDockOffset(value: number) {
  const next = Math.min(DOCK_OFFSET_MAX, Math.max(DOCK_OFFSET_MIN, Math.round(Number(value) || 0)))
  devModeDockOffset.value = next
  writeNumber(DEV_MODE_DOCK_KEY, next)
}

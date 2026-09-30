import { watch } from 'vue'
import { useStorage } from '@vueuse/core'

/** 字号缩放存储 key */
export const FONT_SCALE_STORAGE_KEY = 'app-font-scale'

/** 字号缩放范围（百分比），100 表示原始字号 */
export const FONT_SCALE_MIN = 85
export const FONT_SCALE_MAX = 125
export const FONT_SCALE_DEFAULT = 100

/** 滑杆与 A- / A+ 按钮的步长（%） */
export const FONT_SCALE_STEP = 5

/**
 * 写到 html 上的 CSS 变量名。
 * TDesign 的字号 token 与自定义样式里的 px 字号都乘以该系数，
 * 变量定义与使用见 assets/styles/main.css。
 */
export const FONT_SCALE_CSS_VAR = '--app-font-scale'

/** 快捷档位 */
export const FONT_SCALE_PRESETS = [
  { nameKey: 'fontScale.small', value: 90 },
  { nameKey: 'fontScale.standard', value: 100 },
  { nameKey: 'fontScale.large', value: 110 },
  { nameKey: 'fontScale.extraLarge', value: 125 },
]

/** 页面字号缩放（与 localStorage 双向同步，单位 %） */
export const themeFontScale = useStorage<number>(
  FONT_SCALE_STORAGE_KEY,
  FONT_SCALE_DEFAULT
)

/** 把缩放值收敛到合法范围，非法值回落到默认值 */
export function clampFontScale(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return FONT_SCALE_DEFAULT
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(num)))
}

/** 读取当前字号缩放 */
export function getFontScale(): number {
  return clampFontScale(themeFontScale.value)
}

/**
 * 应用字号缩放：把系数（100% -> 1）写到 html 的 CSS 变量。
 * 只影响字号，不改动任何高度/间距，因此不会影响 100vh 布局。
 */
export function applyFontScale(value: unknown = getFontScale()) {
  const scale = clampFontScale(value)
  document.documentElement.style.setProperty(
    FONT_SCALE_CSS_VAR,
    String(scale / 100)
  )
}

/** 设置并持久化字号缩放 */
export function setFontScale(value: unknown) {
  themeFontScale.value = clampFontScale(value)
}

/** 恢复默认字号 */
export function resetFontScale() {
  setFontScale(FONT_SCALE_DEFAULT)
}

/** 初始化字号缩放（App 启动时调用） */
export function initFontScale() {
  applyFontScale()
}

// 缩放值变化时应用到页面（含跨标签页同步）
watch(themeFontScale, () => applyFontScale(), { immediate: true })

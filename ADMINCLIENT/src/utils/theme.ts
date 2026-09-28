import { watch } from 'vue'
import { useStorage } from '@vueuse/core'

/** 主题色存储 key */
export const THEME_COLOR_STORAGE_KEY = 'theme-color'

/** 预设主题色（与 TDesign 官网一致的常用品牌色） */
export interface ThemeColorOption {
  /** 颜色名称的 i18n key，如 themeColors.blue */
  nameKey: string
  /** 品牌色十六进制值 */
  value: string
}

export const PRESET_THEME_COLORS: ThemeColorOption[] = [
  { nameKey: 'themeColors.blue', value: '#0052d9' },
  { nameKey: 'themeColors.cyan', value: '#0594fa' },
  { nameKey: 'themeColors.green', value: '#00a870' },
  { nameKey: 'themeColors.orange', value: '#ed7b2f' },
  { nameKey: 'themeColors.red', value: '#e34d59' },
  { nameKey: 'themeColors.purple', value: '#834ec2' },
]

/** 明暗模式（与 localStorage 双向同步） */
export const themeMode = useStorage<'light' | 'dark'>('theme-mode', 'light')

type RGB = [number, number, number]

const WHITE: RGB = [255, 255, 255]
const BLACK: RGB = [0, 0, 0]

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '')
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('')
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function mix(base: RGB, target: RGB, weight: number): string {
  const rgb = base.map((v, i) =>
    Math.round(v + ((target[i] ?? 0) - v) * weight)
  ) as RGB
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/**
 * 根据品牌色生成 TDesign 的 10 阶色板
 * 浅色模式：第 7 阶为品牌色，1-6 阶渐浅，8-10 阶渐深
 * 深色模式：第 7 阶为品牌色，8-10 阶渐亮，1-6 阶渐暗
 */
export function generateBrandPalette(baseHex: string, dark = false): string[] {
  const base = hexToRgb(baseHex)
  const baseStr = mix(base, WHITE, 0)

  // 浅色：向白色混合的比例（index 1-6）
  const lightWhiteRatio = [0.95, 0.85, 0.7, 0.55, 0.4, 0.2]
  // 浅色：向黑色混合的比例（index 8-10）
  const lightBlackRatio = [0.16, 0.32, 0.48]
  // 深色：向黑色混合的比例（index 1-6）
  const darkBlackRatio = [0.52, 0.46, 0.4, 0.33, 0.25, 0.12]
  // 深色：向白色混合的比例（index 8-10）
  const darkWhiteRatio = [0.18, 0.33, 0.48]

  if (!dark) {
    return [
      ...lightWhiteRatio.map((w) => mix(base, WHITE, w)),
      baseStr,
      ...lightBlackRatio.map((w) => mix(base, BLACK, w)),
    ]
  }
  return [
    ...darkBlackRatio.map((w) => mix(base, BLACK, w)),
    baseStr,
    ...darkWhiteRatio.map((w) => mix(base, WHITE, w)),
  ]
}

/** 读取当前主题色 */
export function getThemeColor(): string {
  return (
    localStorage.getItem(THEME_COLOR_STORAGE_KEY) ||
    PRESET_THEME_COLORS[0]?.value ||
    '#0052d9'
  )
}

/**
 * 应用主题色：把生成的 10 阶色板写到 html 上的 CSS 变量，
 * TDesign 的派生变量（--td-brand-color 等）会自动随之变化。
 */
export function applyThemeColor(hex: string) {
  const isDark = document.documentElement.getAttribute('theme-mode') === 'dark'
  const palette = generateBrandPalette(hex, isDark)
  const style = document.documentElement.style
  palette.forEach((color, index) => {
    style.setProperty(`--td-brand-color-${index + 1}`, color)
  })
}

/** 设置并持久化主题色 */
export function setThemeColor(hex: string) {
  localStorage.setItem(THEME_COLOR_STORAGE_KEY, hex)
  applyThemeColor(hex)
}

let themeObserverStarted = false

/** 初始化主题：应用已保存的主题色，并监听明暗模式变化时重刷色板 */
export function initTheme() {
  // 用存储的明暗模式同步 html 属性（登录页强制亮色后，进入首页需要恢复暗黑）
  document.documentElement.setAttribute(
    'theme-mode',
    themeMode.value === 'dark' ? 'dark' : 'light'
  )
  applyThemeColor(getThemeColor())
  if (!themeObserverStarted) {
    themeObserverStarted = true
    const observer = new MutationObserver(() => {
      applyThemeColor(getThemeColor())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['theme-mode'],
    })
  }
}

// 主题模式变化时同步 html 属性并重刷色板
watch(
  themeMode,
  (val) => {
    const mode = val === 'dark' ? 'dark' : 'light'
    document.documentElement.setAttribute('theme-mode', mode)
    applyThemeColor(getThemeColor())
  },
  { immediate: true }
)

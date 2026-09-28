import { themeMode } from './theme'

let transitioning = false

/**
 * 明暗模式切换：使用 View Transitions 实现“扫过区域实时变色”的斜切转场
 *
 * 白天 → 黑夜：暗色主题从左往右斜切揭晓，扫过的区域实时变为暗色
 * 黑夜 → 白天：亮色主题从右往左斜切揭晓，扫过的区域实时变为亮色
 *
 * 不支持 View Transitions 的浏览器直接切换（无转场）。
 */
export function switchThemeWithCurtain(next: 'dark' | 'light') {
  if (transitioning || themeMode.value === next) return
  transitioning = true

  const apply = () => {
    const root = document.documentElement
    root.classList.remove('theme-sweep-to-dark', 'theme-sweep-to-light')
    root.classList.add(next === 'dark' ? 'theme-sweep-to-dark' : 'theme-sweep-to-light')
    themeMode.value = next
  }

  const finish = () => {
    document.documentElement.classList.remove('theme-sweep-to-dark', 'theme-sweep-to-light')
    transitioning = false
  }

  if (typeof (document as any).startViewTransition === 'function') {
    const vt = (document as any).startViewTransition(apply)
    vt.finished.catch(() => {}).finally(finish)
    return
  }

  // 兜底：直接切换
  apply()
  finish()
}

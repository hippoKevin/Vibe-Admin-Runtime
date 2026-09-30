import { manifest } from 'tdesign-icons-vue-next'
import * as TDesignIcons from 'tdesign-icons-vue-next'

/**
 * 图标兜底：menu_icon 为空或图标名已下线时使用
 * （'app' 是 tdesign-icons 内置图标，保证能取到）
 */
const FALLBACK_ICON_STEM = 'app'

/**
 * 根据菜单的 menu_icon（图标标识，如 setting-1）取图标组件
 *
 * 注意：menu_icon 允许为空（数据库只保证非 null，可能是空字符串），
 * 直接写 manifest.find(f => f.stem === menu_icon).icon 会抛
 * "Cannot read properties of undefined (reading 'icon')"，这里统一兜底。
 */
export function getMenuIconComponent(menuIcon?: string | null) {
  const stem = String(menuIcon ?? '').trim()

  const matched = stem
    ? manifest.find((item) => item.stem === stem)
    : undefined

  const target = matched || manifest.find((item) => item.stem === FALLBACK_ICON_STEM)
  if (!target) return undefined

  return TDesignIcons[`${target.icon}Icon` as keyof typeof TDesignIcons]
}

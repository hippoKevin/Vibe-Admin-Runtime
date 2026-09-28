import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import enUS from './en-US'

export type AppLocale = 'zh-CN' | 'en-US'

export const LOCALE_STORAGE_KEY = 'app-locale'

export const SUPPORTED_LOCALES: AppLocale[] = ['zh-CN', 'en-US']

export function getInitialLocale(): AppLocale {
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as AppLocale | null
  if (saved && SUPPORTED_LOCALES.includes(saved)) {
    return saved
  }
  const lang = (navigator.language || '').toLowerCase()
  return lang.startsWith('zh') ? 'zh-CN' : 'en-US'
}

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

/** 切换语言并持久化 */
export function setAppLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

/** 翻译服务端返回的固定文本（菜单名、列标题等），找不到时原样返回 */
export function translateServerText(text: string | null | undefined): string {
  if (!text) return text ?? ''
  // 显式读取当前 locale，使模板中的调用能响应语言切换
  void i18n.global.locale.value
  const t = i18n.global.t
  const menuKey = `menuNames.${text}` as const
  const columnKey = `columnTitles.${text}` as const
  const apiKey = `apiMessage.${text}` as const
  const menu = t(menuKey)
  if (menu && menu !== menuKey) return menu
  const column = t(columnKey)
  if (column && column !== columnKey) return column
  const api = t(apiKey)
  if (api && api !== apiKey) return api
  return text
}

export default i18n

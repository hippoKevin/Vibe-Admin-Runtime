/**
 * Short Text Formatting
 * 短文本格式化
 *
 * 操作审计的参数摘要历史数据里存的是完整 JSON，直接渲染又长又难读，
 * 这里统一压成短的 key=value 文本，保证列表里不出现 JSON 与长文本。
 */

/** 优先展示的字段名：命中这些关键字的键排在前面 */
const PRIORITY_KEY_PATTERN = /(id|name|account|username|role|menu|title|code|status|key|type)/i

/** 单个字段值的最大长度，超过的直接不展示 */
const MAX_VALUE_LENGTH = 40

/** 一条摘要最多展示的字段数 */
const MAX_FIELD_COUNT = 6

/** 一条摘要的总长度上限 */
const MAX_TOTAL_LENGTH = 120

/** 递归解析的最大层级，防止异常深的结构拖慢渲染 */
const MAX_DEPTH = 3

/** 脱敏值（全是星号）不展示 */
const MASKED_PATTERN = /^\*+$/

/** 待展示的字段 */
interface SummaryField {
  key: string
  value: string
}

/**
 * 截断文本
 * 超过长度上限时截断并补省略号
 * @param text 原始文本
 * @param maxLength 最大长度
 */
export function truncateText(text: string, maxLength: number): string {
  const value = String(text ?? '')
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}…`
}

/**
 * 标量取值
 * 只保留字符串 / 数字 / 布尔；空值、脱敏值、超长文本都返回空串表示不展示
 * @param value 任意值
 */
function normalizeScalar(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return ''

  const text = String(value).trim()
  if (!text) return ''
  if (MASKED_PATTERN.test(text)) return ''
  if (text.length > MAX_VALUE_LENGTH) return ''

  return text
}

/**
 * 抽取标量字段
 * 对象递归下钻，数组只保留条目数（key=[N项]），同名键只保留先出现的
 * @param root 解析后的 JSON
 * @param arrayLabel 数组条目的展示文案，缺省为 [N]
 */
function extractFields(root: unknown, arrayLabel?: (count: number) => string): SummaryField[] {
  const fields: SummaryField[] = []
  const usedKeys = new Set<string>()

  const push = (key: string, value: string) => {
    const name = String(key || '').trim()
    if (!name || !value || usedKeys.has(name)) return

    usedKeys.add(name)
    fields.push({ key: name, value })
  }

  const walk = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return

    Object.entries(node as Record<string, unknown>).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        push(key, arrayLabel ? arrayLabel(value.length) : `[${value.length}]`)
        return
      }
      if (value && typeof value === 'object') {
        walk(value, depth + 1)
        return
      }
      push(key, normalizeScalar(value))
    })
  }

  walk(root, 0)
  return fields
}

/**
 * 字段排序
 * 键名命中关键字的排前面，其余保持原有顺序
 * @param fields 待排序字段
 */
function sortFields(fields: SummaryField[]): SummaryField[] {
  return fields
    .map((field, index) => ({ field, index }))
    .sort((prev, next) => {
      const prevRank = PRIORITY_KEY_PATTERN.test(prev.field.key) ? 0 : 1
      const nextRank = PRIORITY_KEY_PATTERN.test(next.field.key) ? 0 : 1
      return prevRank - nextRank || prev.index - next.index
    })
    .map((item) => item.field)
}

/**
 * 拼接摘要
 * 最多取 6 个字段，用逗号连接，超长截断
 * @param fields 已抽取的字段
 */
function joinFields(fields: SummaryField[]): string {
  const text = sortFields(fields)
    .slice(0, MAX_FIELD_COUNT)
    .map((field) => `${field.key}=${field.value}`)
    .join(', ')

  return truncateText(text, MAX_TOTAL_LENGTH)
}

/**
 * 参数摘要格式化
 * 老数据（以 { 或 [ 开头的 JSON）递归抽取标量后拼成 key=value；
 * 新数据后端已存短摘要（menuId=128, username=admin），直接截断展示；
 * 解析失败或没有可展示字段时返回空串，绝不回退成显示 JSON。
 * @param summary 后端返回的摘要原文
 * @param arrayLabel 数组条目的展示文案，如 (count) => `[${count} 项]`
 */
export function formatSummaryText(
  summary?: string | null,
  arrayLabel?: (count: number) => string
): string {
  const text = String(summary ?? '').trim()
  if (!text) return ''

  // 1. 历史 JSON 数据：解析后再压缩
  if (text.startsWith('{') || text.startsWith('[')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      // 解析失败时不能把原始 JSON 露出来
      return ''
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return ''

    const fields = extractFields(parsed, arrayLabel)
    return fields.length ? joinFields(fields) : ''
  }

  // 2. 新数据已经是短摘要，直接按总长截断
  return truncateText(text, MAX_TOTAL_LENGTH)
}

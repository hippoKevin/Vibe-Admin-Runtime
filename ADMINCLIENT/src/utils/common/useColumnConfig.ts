import { computed, ref } from 'vue'
import { translateServerText } from '@/locales'

/**
 * 表格列配置组合式函数
 *
 * 后端 column_config 中的标题为中文，显示时通过 translateServerText 翻译；
 * 保存时还原为原始标题，避免把翻译后的英文写回数据库。
 */
export function useColumnConfig() {
  /** 后端原始列配置（含中文标题、cell 渲染函数） */
  const rawColumns = ref<any[]>([])

  /** 用于渲染的列配置，标题经过翻译 */
  const displayColumns = computed(() =>
    rawColumns.value.map((item: any) => ({
      ...item,
      title: translateServerText(item.title),
    }))
  )

  /** 将显示列还原为原始标题（用于保存回后端） */
  function restoreRawTitles(columns: any[]) {
    const rawTitleMap: Record<string, string> = {}
    rawColumns.value.forEach((item: any) => {
      rawTitleMap[item.colKey] = item.title
    })
    return columns.map((item: any) => ({
      ...item,
      title: rawTitleMap[item.colKey] ?? item.title,
    }))
  }

  /** 生成提交到后端的列配置（去掉 cell 等运行时字段，并补充 displayIndex） */
  function toSubmitColumns(columns: any[]) {
    const submit = JSON.parse(JSON.stringify(restoreRawTitles(columns)))
    return submit.map((item: any, index: number) => {
      delete item.cell
      item.displayIndex = index
      return item
    })
  }

  /** 设置列配置，并为 index 列注入序号渲染 */
  function setColumns(
    columnConfig: any[],
    pageNumber: () => number,
    pageSize: () => number
  ) {
    const cols = JSON.parse(JSON.stringify(columnConfig || []))
    cols.forEach((item: any) => {
      if (item.colKey === 'index') {
        item.cell = (h: any, { rowIndex }: any) =>
          h(
            'span',
            { class: 't-table__cell-index' },
            (pageNumber() - 1) * pageSize() + rowIndex + 1
          )
      }
    })
    rawColumns.value = cols
  }

  return {
    rawColumns,
    displayColumns,
    setColumns,
    toSubmitColumns,
    restoreRawTitles,
  }
}

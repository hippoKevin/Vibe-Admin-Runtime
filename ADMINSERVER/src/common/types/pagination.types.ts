// src/common/types/pagination.types.ts

export interface FilterData {
  fieldName: string
  fieldType: string
  fieldValue: string | number | null | undefined
  fieldValue1?: string | number | null | undefined
  operation: string
  andNext: string   // '0'=OR '1'=AND '-1'=NONE
  type: string
  dataType?: string
}

export interface SearchForm {
  ep?: Record<string, any>
  paging?: {
    pageNumber?: number
    pageSize?: number
    sortField?: string
    sortDirection?: string
  }
  cdList?: FilterData[]  // ← 过滤条件列表
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  pageNumber: number
  pageSize: number
}
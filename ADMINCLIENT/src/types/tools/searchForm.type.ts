// 定义分页类型
export interface SearchPaging {
    pageNumber: number;
    pageSize: number;
    sortDirection?: string; // 可选
    sortField?: string;     // 可选
  }
  
  // 定义整个 searchForm 类型
  export interface SearchForm {
    Rep: Record<string, any>; // 你写的 Re ep 应该是 Rep
    paging: SearchPaging;
    cdList: any[];
  }
import type { SearchForm } from "@/types/tools/searchForm.type";
import requestApi from "@/utils/request/request";

import { useUserStore } from "@/stores/userStore";

const userStore = useUserStore();

// 获取菜单配置
export function getMenuStatus(menu_id: number) {
    return requestApi({
      url: '/hippoadmin/menu/status/' + menu_id,
      method: 'get',
    })
  }
  
  // 设置菜单配置
  export function setMenuStatus(menu_status_id: number, data: any) {
    return requestApi({
      url: '/hippoadmin/menu/status/update/' + menu_status_id,
      method: 'post',
      data: {
        column_config: data
      },
    })
  }

/** 获取菜单下拉列表（用于新增时选择菜单） */
export function getMenuOptions() {
  // 获取当前用户id
  const userId = userStore.userInfo.data.user_id;

  return requestApi({
    url: '/hippoadmin/menu/options/' + userId,
    method: 'GET',
  })
}

// 导入数据
export function importData(tableName: string, file: File, menu_id: number) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('tableName', tableName)
  // 列模板序列化后传入
  
  return requestApi({
    url: '/hippoadmin/excel/import/' + menu_id,
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

// 获取导入历史
export function getImportHistory(searchForm: SearchForm) {
  return requestApi({
    url: '/hippoadmin/excel/importhistory/list',
    method: 'get',
    params: searchForm
  })
}


// 清空历史
export function cleanHistory() {
  return requestApi({
    url: '/hippoadmin/excel/clearHistory',
    method: 'get'
  })
}
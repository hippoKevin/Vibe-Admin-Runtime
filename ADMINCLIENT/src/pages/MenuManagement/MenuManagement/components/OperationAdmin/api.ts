import requestApi from "@/utils/request/request";

// 获取操作列表
export const getOperationList = (menuId: number) => {
    return requestApi({
      url: '/hippoadmin/menu/getOperationList',
      method: 'get',
      params: { menuId },
    });
}

// 获取接口列表
export function getPortList() {
    return requestApi({
        url: '/hippoadmin/port/all',
        method: 'get',
    })
}

  
  // 添加操作
  export const addOperation = (data: any) => {
    return requestApi({
      url: '/hippoadmin/menu/addOperation',
      method: 'post',
      data,
    });
  }
  
  // 删除操作
  export const deleteOperation = (operationId: number) => {
    return requestApi({
      url: '/hippoadmin/menu/deleteOperation',
      method: 'get',
      params: { operationId },
    });
  }
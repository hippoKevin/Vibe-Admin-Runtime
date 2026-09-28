import requestApi from "@/utils/request/request";

// 添加菜单
export function addUser(data: any) {
    return requestApi({
      url: 'hippoadmin/user/add',
      method: 'post',
      data,
    })
  }

// 获取权限列表
export function getRoleList(data: any) {
    return requestApi({
      url: '/hippoadmin/role/list',
      method: 'get',
      data,
    })
  }
  
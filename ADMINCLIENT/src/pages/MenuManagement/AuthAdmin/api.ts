import requestApi from "@/utils/request/request";

// 获取用户列表
export function getRoleList(data: any) {
  return requestApi({
    url: '/hippoadmin/role/list',
    method: 'get',
    params: data,
  })
}

// 删除角色
export function deleteRole(role_id: number) {
  return requestApi({
    url: `/hippoadmin/role/delete/${role_id}`,
    method: "post",
  });
}

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
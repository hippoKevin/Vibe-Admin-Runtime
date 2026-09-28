import requestApi from "@/utils/request/request";

// 获取权限数
export function getAuthMenuList(data: any) {
  return requestApi({
    url: "/hippoadmin/menu/list",
    method: "get",
    params: data,
  });
}

// 获取该角色权限
export function getRoleAuthList(role_id: number) {
  return requestApi({
    url: `/hippoadmin/role/auth/${role_id}`,
    method: "get",
  });
}

// 修改该角色权限
export function configRoleAuth(role_id: number, data: any) {
  return requestApi({
    url: `/hippoadmin/role/auth/config/${role_id}`,
    method: "post",
    data,
  });
}


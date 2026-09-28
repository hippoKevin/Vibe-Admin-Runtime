import requestApi from "@/utils/request/request";

// 获取权限数据
export function getRoleData(role_id: number) {
    return requestApi({
        url: '/hippoadmin/role/' + role_id,
        method: 'get'
    })
}

// 修改权限数据
export function updateRoleData(role_id: number, data: any) {
    return requestApi({
        url: '/hippoadmin/role/update/' + role_id,
        method: 'post',
        data
    })
}

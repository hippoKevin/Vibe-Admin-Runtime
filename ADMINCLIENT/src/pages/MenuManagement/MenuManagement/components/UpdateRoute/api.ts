import requestApi from "@/utils/request/request";

// 获取菜单详情
export function getMenuDetail(menuId: any) {
    return requestApi({
        url: '/hippoadmin/menu/getMenuById',
        method: 'get',
        params: { menuId }
    })
}

// 修改菜单
export function updateMenu(data: any) {
    return requestApi({
        url: '/hippoadmin/menu/updateMenu',
        method: 'post',
        data
    })
}
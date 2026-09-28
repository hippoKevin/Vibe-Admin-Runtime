import requestApi from "@/utils/request/request";

// 获取菜单列表
export function getMenuList(searchForm: any) {
    return requestApi({
        url: '/hippoadmin/menu/list',
        method: 'get',
        params: searchForm
    })
}

// 删除菜单
export function deleteMenu(menuId: any) {
    return requestApi({
        url: '/hippoadmin/menu/delete',
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

// 新增菜单
export function addMenu(data: any) {
    return requestApi({
        url: '/hippoadmin/menu/addMenu',
        method: 'post',
        data
    })
}
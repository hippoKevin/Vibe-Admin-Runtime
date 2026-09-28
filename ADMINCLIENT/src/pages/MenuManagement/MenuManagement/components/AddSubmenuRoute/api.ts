import requestApi from "@/utils/request/request";

// 添加菜单
export function addMenu(data: any) {
    return requestApi({
        url: '/hippoadmin/menu/addMenu',
        method: 'post',
        data
    })
}
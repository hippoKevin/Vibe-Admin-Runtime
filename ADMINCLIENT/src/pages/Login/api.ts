import requestApi from "@/utils/request/request";

// 登录
export function login(data: any) {
    return requestApi({
        url: '/hippoadmin/common/login',
        method: 'post',
        data
    })
}

// 获取路由菜单
export function getMenuList() {
    return requestApi({
        url: '/hippoadmin/menu/list',
        method: 'get'
    })
}
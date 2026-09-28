import requestApi from "@/utils/request/request";

// 获取节点变更历史
export function getUserInfoForToken() {
    return requestApi({
        url: '/hippoadmin/common/refresh_token',
        method: 'POST'
    });
}

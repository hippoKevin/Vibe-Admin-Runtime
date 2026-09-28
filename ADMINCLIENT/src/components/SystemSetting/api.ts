import requestApi from "@/utils/request/request";

// 恢复默认
export function resetDefault(data?: any) {
    return requestApi({
        url: "/hippoadmin/common/refresh_default",
        method: "post",
        data
    });
} 
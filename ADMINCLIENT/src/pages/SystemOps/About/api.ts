import requestApi from "@/utils/request/request";

/** 获取服务端运行信息（应用、运行时、CPU、内存、磁盘、数据库、日志与配置文件） */
export function getSystemAbout() {
    return requestApi({
        url: '/hippoadmin/system-ops/about',
        method: 'get'
    });
}

/** 获取监控采样数据（CPU、内存趋势与当前磁盘、运行时长） */
export function getSystemMetrics() {
    return requestApi({
        url: '/hippoadmin/system-ops/metrics',
        method: 'get'
    });
}

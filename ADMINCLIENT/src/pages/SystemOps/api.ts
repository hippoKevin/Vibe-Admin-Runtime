import requestApi from "@/utils/request/request";

/** 关于系统：服务端运行信息、资源占用、数据库连接情况 */
export function getSystemAbout() {
    return requestApi({
        url: '/hippoadmin/system-ops/about',
        method: 'get'
    });
}

/** 服务存活探测（重启后轮询用，无需登录） */
export function getSystemAlive() {
    return requestApi({
        url: '/hippoadmin/system-ops/ping',
        method: 'get'
    });
}

/** 日志文件列表 */
export function getLogFiles() {
    return requestApi({
        url: '/hippoadmin/system-ops/log/files',
        method: 'get'
    });
}

/** 读取日志内容 */
export function readLog(params: {
    file?: string;
    lines?: number | string;
    level?: string;
    keyword?: string;
}) {
    return requestApi({
        url: '/hippoadmin/system-ops/log/read',
        method: 'get',
        params
    });
}

/** 清空日志文件 */
export function clearLog(file?: string) {
    return requestApi({
        url: '/hippoadmin/system-ops/log/clear',
        method: 'post',
        data: { file }
    });
}

/** 环境变量文件详情（敏感项不回显） */
export function getEnvDetail(file?: string) {
    return requestApi({
        url: '/hippoadmin/system-ops/env/detail',
        method: 'get',
        params: { file }
    });
}

/** 保存环境变量文件，可选重启 */
export function saveEnv(data: {
    file: string;
    items: { key: string; value: string }[];
    deletedKeys?: string[];
    restart?: boolean;
}) {
    return requestApi({
        url: '/hippoadmin/system-ops/env/save',
        method: 'post',
        data
    });
}

/** 重启系统 */
export function restartSystem() {
    return requestApi({
        url: '/hippoadmin/system-ops/restart',
        method: 'post'
    });
}

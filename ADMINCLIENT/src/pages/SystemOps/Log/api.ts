import requestApi from "@/utils/request/request";

/** 获取操作审计列表（支持关键字、操作人、操作类型、执行结果筛选与分页） */
export function getAuditList(data: any) {
    return requestApi({
        url: '/hippoadmin/system-ops/audit/list',
        method: 'get',
        params: data
    });
}

/** 获取操作类型下拉选项（后端由 operation_list 反查出中文操作名） */
export function getAuditActions() {
    return requestApi({
        url: '/hippoadmin/system-ops/audit/actions',
        method: 'get'
    });
}

/** 获取服务端日志文件列表 */
export function getLogFiles() {
    return requestApi({
        url: '/hippoadmin/system-ops/log/files',
        method: 'get'
    });
}

/** 读取服务端原始日志内容（支持级别、行数、关键字过滤） */
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

/** 清空指定的服务端日志文件 */
export function clearLog(file?: string) {
    return requestApi({
        url: '/hippoadmin/system-ops/log/clear',
        method: 'post',
        data: { file }
    });
}

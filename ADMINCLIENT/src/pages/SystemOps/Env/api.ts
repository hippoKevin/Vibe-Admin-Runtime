import requestApi from "@/utils/request/request";

/** 获取环境配置文件详情（敏感项不回显内容） */
export function getEnvDetail(file?: string) {
    return requestApi({
        url: '/hippoadmin/system-ops/env/detail',
        method: 'get',
        params: { file }
    });
}

/** 保存环境配置文件，可选删除项与保存后重启 */
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

/** 重启系统服务（不修改任何配置） */
export function restartSystem() {
    return requestApi({
        url: '/hippoadmin/system-ops/restart',
        method: 'post'
    });
}

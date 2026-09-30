import requestApi from "@/utils/request/request";

/** 本页管理的资产类型：工具（ADMINAGENT/tools，主文档 TOOL.md） */
const KIND = 'tool'

/** 获取智能管理概览（harness 版本、开发模式状态、三类资产数量与根目录） */
export function getOverview() {
    return requestApi({
        url: '/hippoadmin/agent-admin/overview',
        method: 'get'
    });
}

/** 获取工具条目列表 */
export function getAssetList() {
    return requestApi({
        url: '/hippoadmin/agent-admin/list',
        method: 'get',
        params: { kind: KIND }
    });
}

/** 获取工具条目详情（file 为条目内相对路径，不传取主文档 TOOL.md） */
export function getAssetDetail(name: string, file?: string) {
    return requestApi({
        url: '/hippoadmin/agent-admin/detail',
        method: 'get',
        params: { kind: KIND, name, file }
    });
}

/** 保存工具条目内的某个文件 */
export function saveAssetFile(data: { name: string; file: string; content: string }) {
    return requestApi({
        url: '/hippoadmin/agent-admin/save',
        method: 'post',
        data: { kind: KIND, ...data }
    });
}

/** 新建工具条目（后端按内置模板生成 TOOL.md） */
export function createAsset(data: { name: string; title?: string }) {
    return requestApi({
        url: '/hippoadmin/agent-admin/create',
        method: 'post',
        data: { kind: KIND, ...data }
    });
}

/** 删除工具条目（连同目录内全部文件） */
export function removeAsset(name: string) {
    return requestApi({
        url: '/hippoadmin/agent-admin/remove',
        method: 'post',
        data: { kind: KIND, name }
    });
}

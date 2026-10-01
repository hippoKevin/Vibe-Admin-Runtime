import requestApi from "@/utils/request/request";

/** 本页管理的资产类型：Agent（ADMINAGENT/agent，主文档 AGENT.md） */
const KIND = 'agent'

/** AI 润色的受理超时：后端立刻返回 runId，正常在毫秒级，给 1 分钟容错 */
const POLISH_ACCEPT_TIMEOUT = 60 * 1000

/** 轮询单次查询的超时：只是读一条运行记录，给 15 秒足够 */
const POLISH_STATUS_TIMEOUT = 15 * 1000

/** 获取智能管理概览（harness 版本、开发模式状态、三类资产数量与根目录） */
export function getOverview() {
    return requestApi({
        url: '/hippoadmin/agent-admin/overview',
        method: 'get'
    });
}

/** 获取 Agent 条目列表 */
export function getAssetList() {
    return requestApi({
        url: '/hippoadmin/agent-admin/list',
        method: 'get',
        params: { kind: KIND }
    });
}

/** 获取 Agent 条目详情（file 为条目内相对路径，不传取主文档 AGENT.md） */
export function getAssetDetail(name: string, file?: string) {
    return requestApi({
        url: '/hippoadmin/agent-admin/detail',
        method: 'get',
        params: { kind: KIND, name, file }
    });
}

/** 保存 Agent 条目内的某个文件 */
export function saveAssetFile(data: { name: string; file: string; content: string }) {
    return requestApi({
        url: '/hippoadmin/agent-admin/save',
        method: 'post',
        data: { kind: KIND, ...data }
    });
}

/** 新建 Agent 条目（后端按内置模板生成 AGENT.md） */
export function createAsset(data: { name: string; title?: string }) {
    return requestApi({
        url: '/hippoadmin/agent-admin/create',
        method: 'post',
        data: { kind: KIND, ...data }
    });
}

/** 删除 Agent 条目（连同目录内全部文件，破坏性最大：只在「更多」菜单里触发） */
export function removeAsset(name: string) {
    return requestApi({
        url: '/hippoadmin/agent-admin/remove',
        method: 'post',
        data: { kind: KIND, name }
    });
}

/**
 * 删除 Agent 条目内的单个文件 / 单个目录（目录递归删）
 *
 * 工具栏「删除」的语义：只删当前选中的那一个节点，不动条目本身。
 */
export function removeAssetNode(data: { name: string; path: string }) {
    return requestApi({
        url: '/hippoadmin/agent-admin/remove-node',
        method: 'post',
        data: { kind: KIND, ...data }
    });
}

/**
 * 启用 / 停用（写进文件顶部的 front matter）
 *
 * 带 file 时只改这个文件的启用状态；不带 file 时改主文档 AGENT.md，
 * 列表项展示的始终是主文档的状态。
 */
export function setAssetEnabled(data: { name: string; enabled: boolean; file?: string }) {
    return requestApi({
        url: '/hippoadmin/agent-admin/enabled',
        method: 'post',
        data: { kind: KIND, ...data }
    });
}

/**
 * 在 Agent 条目目录里新建目录 / 文件
 *
 * parent 为条目内相对目录（'' 或省略 = 条目根目录），
 * nodeType 为 dir / file（文件名没有后缀时后端会补 .md）。
 */
export function createAssetNode(data: {
    name: string;
    parent?: string;
    nodeType: 'dir' | 'file';
    nodeName: string;
}) {
    return requestApi({
        url: '/hippoadmin/agent-admin/node',
        method: 'post',
        data: { kind: KIND, ...data }
    });
}

/**
 * AI 润色 Agent 条目内的某个文件（异步：立刻返回 runId，再用 getPolishStatus 轮询）
 *
 * 一次润色约 100 秒，同步接口会超时/空等，所以后端改成先受理再轮询进度。
 */
export function polishAsset(data: { name: string; file?: string }) {
    return requestApi({
        url: '/hippoadmin/agent-admin/polish',
        method: 'post',
        data: { kind: KIND, ...data },
        // 只是「受理」，后端立刻返回，给 1 分钟足够
        timeout: POLISH_ACCEPT_TIMEOUT
    });
}

/** 查询润色进度（runId 来自 polishAsset 的返回） */
export function getPolishStatus(data: { name: string; file?: string; runId: string }) {
    return requestApi({
        url: '/hippoadmin/agent-admin/polish/status',
        method: 'get',
        params: { kind: KIND, ...data },
        timeout: POLISH_STATUS_TIMEOUT
    });
}

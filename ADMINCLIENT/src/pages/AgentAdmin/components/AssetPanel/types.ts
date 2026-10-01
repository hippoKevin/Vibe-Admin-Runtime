/**
 * 智能管理（技能 / Agent / 工具）公共类型
 *
 * 三个页面（Skill / Agent / Tool）结构完全一致：
 * 每个页面各自维护同目录的 api.ts（kind 固定），把接口集合与 kind 一起交给
 * 共用的 AssetPanel 渲染，避免三份重复代码。
 */

/** 能力资产类型：技能 / Agent / 工具 */
export type AssetKind = 'skill' | 'agent' | 'tool'

/** 概览返回：harness 情况、开发模式状态、三类资产数量与目录 */
export interface AssetOverview {
  /** 开源 Agent 运行时（DeepSeek Harness） */
  harness: { present: boolean; version: string | null; path: string }
  /** 开发模式（语音生成代码）是否就绪 */
  dsh: { ready: boolean; hint: string | null }
  /** 三类资产各自的数量 */
  counts: Record<string, number>
  /** 三类资产各自的根目录 */
  roots: Record<string, string>
}

/** 列表项 */
export interface AssetItem {
  /** 条目名称（目录名） */
  name: string
  /** 主文档一级标题 */
  title: string
  /** 主文档里的一句话描述 */
  description: string
  /** 主文档文件名，如 SKILL.md */
  docName: string
  /** 主文档是否存在 */
  hasDoc: boolean
  /** 目录内文件数 */
  fileCount: number
  /** 目录内文件总大小 */
  size: number
  /** 最近更新时间 */
  updatedAt: string
  /** 是否启用（读自主文档顶部 front matter 的 enabled，缺省为启用） */
  enabled: boolean
}

/** 条目内的文件或目录 */
export interface AssetFile {
  /** 文件名 */
  name: string
  /** 条目目录内的相对路径，如 workflow/new-page.md */
  path: string
  size: number
  updatedAt: string
  /** 是否允许在线编辑（后端按后缀白名单判定；目录恒为 false） */
  editable: boolean
  /**
   * 节点类型
   *
   * 后端 listFiles 会把目录也作为一项返回（type: 'dir'），
   * 否则「新建的空目录」不会出现在文件树里。
   * 判定目录一律以此字段为准，不要再靠「有没有点 / 能不能编辑」猜。
   */
  type?: 'dir' | 'file'
}

/** 条目详情：某个文件的内容 + 目录内文件清单 */
export interface AssetDetail {
  kind: AssetKind
  name: string
  docName: string
  /** 本次返回内容对应的文件（不传 file 时是主文档） */
  file: string
  hasDoc: boolean
  /** 条目目录在服务器上的绝对路径 */
  path: string
  /** 文件内容 */
  content: string
  files: AssetFile[]
  /** 是否启用：传了 file 时表示「该文件」的启用状态，不传时表示主文档的 */
  enabled: boolean
}

/**
 * AI 润色受理结果（异步接口：立刻返回 runId，前端轮询进度）
 *
 * 为什么改成异步：一次润色实测约 100 秒，同步接口会让前端长时间空等，
 * 用户以为「点了没反应」就反复点，而并发锁又只允许一个任务 → 后续点击全报错。
 */
export interface AssetPolishAccepted {
  /** 是否已开始 */
  started: boolean
  /** 轮询进度用的运行 id */
  runId: string
  name: string
  /** 本次润色的文件（条目内相对路径） */
  file: string
  /** 文件在仓库内的相对路径 */
  path: string
  /** 润色前的字节数，用来判断是否真的被改写 */
  beforeSize: number
}

/** 润色进度（轮询 /agent-admin/polish/status） */
export interface AssetPolishStatus {
  name: string
  file: string
  path: string
  runId: string
  /** 仍在执行 */
  running: boolean
  /** 后端是否已登记这条运行记录 */
  found: boolean
  ok: boolean
  exitCode: number | null
  /** 运行耗时（毫秒） */
  duration: number
  /** DSH 的最终答复 */
  output: string
  error?: string
  /** 该文件当前字节数 */
  size: number
}

/**
 * 页面接口集合
 *
 * AssetPanel 需要的能力由各页面同目录的 api.ts 提供（kind 已在 api.ts 内固定）。
 */
export interface AssetApi {
  /** 获取概览 */
  getOverview: () => Promise<any>
  /** 获取条目列表 */
  getAssetList: () => Promise<any>
  /** 获取条目详情（file 为条目内相对路径，不传取主文档） */
  getAssetDetail: (name: string, file?: string) => Promise<any>
  /** 保存条目内某个文件 */
  saveAssetFile: (data: { name: string; file: string; content: string }) => Promise<any>
  /** 新建条目 */
  createAsset: (data: { name: string; title?: string }) => Promise<any>
  /** 删除条目（连同目录内全部文件，破坏性最大：只在「更多」菜单里触发） */
  removeAsset: (name: string) => Promise<any>
  /**
   * 删除条目内的单个文件 / 单个目录（目录递归删）
   *
   * 这是工具栏「删除」的语义：只删当前选中的那一个节点，不动条目本身。
   */
  removeAssetNode: (data: { name: string; path: string }) => Promise<any>
  /** 启用 / 停用：传了 file 只改这个文件，否则改主文档（写进文件顶部 front matter） */
  setAssetEnabled: (data: { name: string; enabled: boolean; file?: string }) => Promise<any>
  /**
   * 在条目目录里新建目录 / 文件
   *
   * parent 为条目内相对目录（'' 或省略 = 条目根目录），
   * nodeType 为 dir / file（文件名没有后缀时后端会补 .md）。
   */
  createAssetNode: (data: {
    name: string
    parent?: string
    nodeType: 'dir' | 'file'
    nodeName: string
  }) => Promise<any>
  /** AI 润色条目内的某个文件（异步：立刻返回 runId，用 getPolishStatus 轮询） */
  polishAsset: (data: { name: string; file?: string }) => Promise<any>
  /** 查询润色进度（runId 来自 polishAsset 的返回） */
  getPolishStatus: (data: { name: string; file?: string; runId: string }) => Promise<any>
}

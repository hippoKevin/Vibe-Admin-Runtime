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

/** 条目内的文件 */
export interface AssetFile {
  /** 文件名 */
  name: string
  /** 条目目录内的相对路径，如 workflow/new-page.md */
  path: string
  size: number
  updatedAt: string
  /** 是否允许在线编辑（后端按后缀白名单判定） */
  editable: boolean
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
  /** 是否启用（恒定看主文档，与当前查看的文件无关） */
  enabled: boolean
}

/** AI 润色结果（同步接口，后端真的改写了磁盘上的 md） */
export interface AssetPolishResult {
  name: string
  /** 本次润色的文件（条目内相对路径） */
  file: string
  /** 文件在仓库内的相对路径 */
  path: string
  ok: boolean
  exitCode: number | null
  /** 耗时（毫秒） */
  duration: number
  output: string
  files: { status: string; path: string }[]
  error?: string
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
  /** 删除条目 */
  removeAsset: (name: string) => Promise<any>
  /** 启用 / 停用条目（写进主文档顶部 front matter） */
  setAssetEnabled: (data: { name: string; enabled: boolean }) => Promise<any>
  /** AI 润色条目内的某个文件（file 为条目内相对路径，不传润色主文档；同步接口，耗时较长） */
  polishAsset: (data: { name: string; file?: string }) => Promise<any>
}

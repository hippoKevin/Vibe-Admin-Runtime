<template>
  <!-- 卡片高度与主体布局由页面 .container 提供（见各页面 index.scss） -->
  <t-card class="asset-panel" data-testid="asset-panel">
    <!-- 工具条：标题 + 计数 + 关键字搜索 + 刷新 + 新建 -->
    <template #title>
      <t-space align="center">
        <span class="asset-panel__title">{{ panelTitle }}</span>
        <t-tag theme="primary" variant="light">{{ $t('agentAdmin.itemCount', { count: filteredItems.length }) }}</t-tag>
        <t-input
          v-model="keyword"
          class="asset-panel__search"
          :placeholder="$t('agentAdmin.searchPlaceholder')"
          clearable
        />
        <t-button theme="success" :loading="refreshing" @click="handleRefresh">
          {{ $t('agentAdmin.refresh') }}
          <template #icon>
            <RefreshIcon />
          </template>
        </t-button>
        <t-button @click="openCreateDialog">
          {{ $t('agentAdmin.create') }}
          <template #icon>
            <AddIcon />
          </template>
        </t-button>
      </t-space>
    </template>

    <!-- 右上：资产类型 + 后台目录 + 运行环境状态（Agent / 工具页保持原样） -->
    <template #actions>
      <t-space class="asset-panel__actions" align="center" :size="8" break-line>
        <!-- 技能页保留「技能」标签；后台目录 / Harness / Dsh 仅 Agent、工具页展示 -->
        <t-tag theme="primary" variant="light">{{ kindLabel }}</t-tag>
        <template v-if="kind !== 'skill'">
          <span class="asset-panel__root" :title="kindRoot">{{ kindRoot || '-' }}</span>
          <t-tag :theme="harnessPresent ? 'success' : 'warning'" variant="light">
            {{ harnessPresent
              ? $t('agentAdmin.harnessVersion', { version: harnessVersion })
              : $t('agentAdmin.harnessMissing') }}
          </t-tag>
          <t-tooltip :content="dshHint">
            <t-tag :theme="dshReady ? 'success' : 'warning'" variant="light">
              {{ dshReady ? $t('agentAdmin.dshReady') : $t('agentAdmin.dshNotReady') }}
            </t-tag>
          </t-tooltip>
        </template>
      </t-space>
    </template>

    <div class="asset-panel__body">
      <!-- 左侧：条目列表 -->
      <aside class="asset-panel__list">
        <div class="asset-panel__list-head">
          <span>{{ $t('agentAdmin.listTitle', { kind: kindLabel }) }}</span>
          <span class="asset-panel__muted">{{ $t('agentAdmin.itemCount', { count: items.length }) }}</span>
        </div>

        <t-loading class="asset-panel__list-loading" :loading="listLoading">
          <div class="asset-panel__list-body">
            <div
              v-for="item in filteredItems"
              :key="item.name"
              class="asset-panel__item"
              :class="{
                'asset-panel__item--active': item.name === activeName,
                'asset-panel__item--disabled': item.enabled === false
              }"
              @click="handleSelectItem(item)"
            >
              <div class="asset-panel__item-head">
                <span class="asset-panel__item-name">{{ item.name }}</span>
                <t-tag v-if="item.enabled === false" theme="default" variant="light" size="small">
                  {{ $t('agentAdmin.enabledTag') }}
                </t-tag>
                <t-tag v-if="!item.hasDoc" theme="warning" variant="light" size="small">
                  {{ $t('agentAdmin.noDoc') }}
                </t-tag>
              </div>
              <div class="asset-panel__item-title">{{ item.title || item.name }}</div>
              <div class="asset-panel__item-desc">
                {{ item.description || $t('agentAdmin.emptyDescription') }}
              </div>
              <div class="asset-panel__item-meta">
                <span>{{ $t('agentAdmin.fileCount', { count: item.fileCount }) }}</span>
                <span>{{ formatBytes(item.size) }}</span>
                <span>{{ formatDateTime(item.updatedAt) }}</span>
              </div>
            </div>

            <div v-if="!filteredItems.length" class="asset-panel__empty">
              {{ $t('agentAdmin.empty') }}
            </div>
          </div>
        </t-loading>
      </aside>

      <!-- 右侧：条目详情 -->
      <section class="asset-panel__detail">
        <template v-if="detail">
          <div class="asset-panel__detail-head">
            <div class="asset-panel__detail-title">
              <span class="asset-panel__detail-name">{{ detail.name }}</span>
              <span class="asset-panel__detail-path" :title="detail.path">{{ detail.path }}</span>
            </div>
            <t-space align="center" :size="8">
              <!-- 启用 / 停用：只作用于「当前正在查看的文件」，状态写进这个文件的 front matter -->
              <span class="asset-panel__enabled">
                <t-tooltip :content="enabledTip">
                  <t-switch
                    v-model="enabledValue"
                    size="small"
                    data-testid="asset-enabled-switch"
                    :loading="enabledLoading"
                    :disabled="isEditing || isPolishing"
                    @change="handleToggleEnabled"
                  />
                </t-tooltip>
                <span
                  class="asset-panel__enabled-label"
                  :class="{ 'asset-panel__enabled-label--off': !enabledValue }"
                >
                  {{ enabledValue ? $t('agentAdmin.enabledOn') : $t('agentAdmin.enabledOff') }}
                </span>
                <span
                  v-if="activeFile"
                  class="asset-panel__enabled-file"
                  data-testid="asset-enabled-file"
                >{{ $t('agentAdmin.enabledFile', { file: activeFile }) }}</span>
              </span>
              <!-- AI 润色：同步接口，只处理当前正在查看的文件，耗时较长 -->
              <t-button
                size="small"
                variant="outline"
                :loading="isPolishing"
                :disabled="isEditing || !activeFile"
                @click="handlePolish"
              >
                {{ isPolishing ? $t('agentAdmin.polishRunning') : $t('agentAdmin.polish') }}
                <template #icon>
                  <StarIcon />
                </template>
              </t-button>
              <t-button v-if="!isEditing" size="small" variant="outline" :disabled="!canEdit" @click="handleStartEdit">
                {{ $t('agentAdmin.edit') }}
                <template #icon>
                  <EditIcon />
                </template>
              </t-button>
              <template v-else>
                <t-button size="small" theme="primary" :loading="saving" @click="handleSave">
                  {{ $t('agentAdmin.save') }}
                </t-button>
                <t-button size="small" variant="outline" :disabled="saving" @click="handleCancelEdit">
                  {{ $t('common.cancel') }}
                </t-button>
              </template>
              <t-button size="small" theme="danger" variant="outline" @click="handleRemove">
                {{ $t('agentAdmin.remove') }}
                <template #icon>
                  <DeleteIcon />
                </template>
              </t-button>
            </t-space>
          </div>

          <t-alert v-if="contentAlert" class="asset-panel__alert" theme="warning" :message="contentAlert" />

          <div class="asset-panel__detail-body">
            <!-- 目录内文件树 -->
            <div class="asset-panel__tree">
              <div class="asset-panel__tree-head">
                <span>{{ $t('agentAdmin.filesTitle') }}</span>
                <t-space align="center" :size="4">
                  <span class="asset-panel__muted">{{ $t('agentAdmin.fileCount', { count: detail.files.length }) }}</span>
                  <!-- 新建位置 = 当前选中的目录（选中文件时用它的父目录；都没选就是条目根目录） -->
                  <t-button
                    size="small"
                    variant="text"
                    data-testid="asset-node-create-dir"
                    @click="openNodeDialog('dir')"
                  >
                    {{ $t('agentAdmin.nodeCreateDir') }}
                  </t-button>
                  <t-button
                    size="small"
                    variant="text"
                    data-testid="asset-node-create-file"
                    @click="openNodeDialog('file')"
                  >
                    {{ $t('agentAdmin.nodeCreateFile') }}
                  </t-button>
                </t-space>
              </div>
              <div class="asset-panel__tree-body">
                <div
                  v-for="row in fileRows"
                  :key="row.path"
                  class="asset-panel__node"
                  :class="{
                    'asset-panel__node--active': !row.isDir && row.path === activeFile,
                    'asset-panel__node--dir': row.isDir,
                    'asset-panel__node--off': !row.isDir && row.enabled === false
                  }"
                  :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
                  :title="row.path"
                  :data-testid="row.isDir ? 'asset-node-dir' : 'asset-node-file'"
                  :data-node-path="row.path"
                  :data-node-enabled="row.isDir ? '' : String(row.enabled)"
                  @click="handleSelectFile(row)"
                >
                  <component
                    :is="row.isDir ? (row.expanded ? FolderOpenIcon : FolderIcon) : FileIcon"
                    class="asset-panel__node-icon"
                  />
                  <span class="asset-panel__node-name">{{ row.name }}</span>
                  <!-- 目录：这一支下面有被停用的文件时给一个弱提示（不做成列表级的红标） -->
                  <span
                    v-if="row.isDir && row.disabledCount"
                    class="asset-panel__node-hint"
                    data-testid="asset-node-dir-hint"
                  >{{ $t('agentAdmin.nodeDirDisabledTag', { count: row.disabledCount }) }}</span>
                  <!-- 文件：停用的整体降透明度 + 一枚小标记，谁被停了一眼可见 -->
                  <span
                    v-else-if="!row.isDir && row.enabled === false"
                    class="asset-panel__node-tag"
                    data-testid="asset-node-off-tag"
                  >{{ $t('agentAdmin.fileDisabledTag') }}</span>
                  <span v-if="!row.isDir" class="asset-panel__node-size">{{ formatBytes(row.size) }}</span>
                </div>

                <div v-if="!fileRows.length" class="asset-panel__empty">{{ $t('agentAdmin.filesEmpty') }}</div>
              </div>
            </div>

            <!-- 文件内容：只读代码区 / 编辑文本域 -->
            <div class="asset-panel__content">
              <div class="asset-panel__content-head">
                <span class="asset-panel__content-file">{{ activeFile || $t('agentAdmin.noFile') }}</span>
                <span class="asset-panel__content-meta">
                  <span v-if="activeFileMeta">{{ formatBytes(activeFileMeta.size) }}</span>
                  <span v-if="activeFileMeta">{{ formatDateTime(activeFileMeta.updatedAt) }}</span>
                  <t-tag
                    v-if="activeFileMeta && !activeFileMeta.editable"
                    theme="warning"
                    variant="light"
                    size="small"
                  >
                    {{ $t('agentAdmin.unsupportedEdit') }}
                  </t-tag>
                  <t-tag v-if="isEditing" theme="primary" variant="light" size="small">
                    {{ $t('agentAdmin.editing') }}
                  </t-tag>
                </span>
              </div>

              <t-loading class="asset-panel__content-loading" :loading="detailLoading || fileLoading">
                <textarea
                  v-if="isEditing"
                  v-model="editContent"
                  class="asset-panel__editor"
                  spellcheck="false"
                />
                <pre v-else class="asset-panel__code">{{ displayContent }}</pre>
              </t-loading>
            </div>
          </div>
        </template>

        <div v-else class="asset-panel__empty asset-panel__empty--detail">
          {{ $t('agentAdmin.selectHint') }}
        </div>
      </section>
    </div>

    <template #footer>
      <div class="asset-panel__footer">
        <span class="asset-panel__footer-path" :title="detail?.path">
          {{ $t('agentAdmin.footerPath', { path: detail?.path || '-' }) }}
        </span>
        <span>{{ $t('agentAdmin.footerDoc', { doc: detail?.docName || '-' }) }}</span>
        <span>{{ $t('agentAdmin.fileCount', { count: detail?.files.length ?? 0 }) }}</span>
        <span>{{ $t('agentAdmin.footerSize', { size: formatBytes(detailSize) }) }}</span>
        <span>{{ $t('agentAdmin.footerUpdated', { time: formatDateTime(detailUpdatedAt) }) }}</span>
      </div>
    </template>
  </t-card>

  <!-- 新建条目弹窗 -->
  <t-dialog
    v-model:visible="createVisible"
    placement="center"
    :header="$t('agentAdmin.createTitle', { kind: kindLabel })"
    :confirm-btn="{ content: $t('agentAdmin.create'), loading: creating }"
    :cancel-btn="{ content: $t('common.cancel') }"
    :close-on-overlay-click="false"
    @confirm="handleCreate"
  >
    <div class="asset-panel__dialog">
      <div class="asset-panel__dialog-item">
        <span class="asset-panel__dialog-label">{{ $t('agentAdmin.nameLabel') }}</span>
        <t-input v-model="createForm.name" :placeholder="$t('agentAdmin.namePlaceholder')" @enter="handleCreate" />
      </div>
      <div class="asset-panel__dialog-item">
        <span class="asset-panel__dialog-label">{{ $t('agentAdmin.titleLabel') }}</span>
        <t-input v-model="createForm.title" :placeholder="$t('agentAdmin.titlePlaceholder')" @enter="handleCreate" />
      </div>
      <div class="asset-panel__dialog-tip">{{ $t('agentAdmin.createTip', { doc: docNameOfKind }) }}</div>
    </div>
  </t-dialog>

  <!-- 新建目录 / 文件弹窗：创建位置 = 当前选中的目录 -->
  <t-dialog
    v-model:visible="nodeVisible"
    placement="center"
    :header="nodeForm.nodeType === 'dir' ? $t('agentAdmin.nodeCreateDirTitle') : $t('agentAdmin.nodeCreateFileTitle')"
    :confirm-btn="{ content: $t('agentAdmin.create'), loading: nodeCreating }"
    :cancel-btn="{ content: $t('common.cancel') }"
    :close-on-overlay-click="false"
    @confirm="handleCreateNode"
  >
    <div class="asset-panel__dialog">
      <div class="asset-panel__dialog-item">
        <span class="asset-panel__dialog-label">{{ $t('agentAdmin.nodeNameLabel') }}</span>
        <t-input
          v-model="nodeForm.nodeName"
          data-testid="asset-node-name-input"
          :placeholder="nodeForm.nodeType === 'dir'
            ? $t('agentAdmin.nodeNamePlaceholderDir')
            : $t('agentAdmin.nodeNamePlaceholderFile')"
          @enter="handleCreateNode"
        />
      </div>
      <div class="asset-panel__dialog-tip" data-testid="asset-node-parent-tip">
        {{ nodeForm.parent ? $t('agentAdmin.nodeParentTip', { parent: `${nodeForm.parent}/` }) : $t('agentAdmin.nodeRootTip') }}
      </div>
    </div>
  </t-dialog>
</template>

<script lang="ts">
export default { name: 'AgentAdminAssetPanel' }
</script>

<script lang="ts" setup>
// 1. 第三方依赖
import { computed, onMounted, ref, type PropType } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  RefreshIcon,
  StarIcon
} from 'tdesign-icons-vue-next'
// 2. 工程内工具
import { useI18n } from 'vue-i18n'
// 3. 类型与接口（接口由各页面同目录 api.ts 通过 prop 传入，kind 已在页面侧固定）
import type {
  AssetApi,
  AssetDetail,
  AssetFile,
  AssetItem,
  AssetKind,
  AssetOverview,
  AssetPolishResult
} from './types'

const props = defineProps({
  /** 能力资产类型：skill / agent / tool */
  kind: {
    type: String as PropType<AssetKind>,
    required: true
  },
  /** 页面提供的接口集合 */
  api: {
    type: Object as PropType<AssetApi>,
    required: true
  }
})

const { t } = useI18n()

/** 名称白名单：与后端 agent-admin.service 保持一致 */
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/** 文件名的后缀白名单（没有后缀时自动补 .md） */
const FILE_EXT_PATTERN = /\.(md|markdown|txt|json|ya?ml|ts|js|mjs|cjs|py|sh|ps1|vue|html|css|scss)$/i

/** 新建文件时没有后缀就补的默认后缀 */
const DEFAULT_FILE_EXT = '.md'

/** 详情接口单文件内容上限：超过会被后端截断，此时不允许保存，避免用截断内容覆盖原文件 */
const CONTENT_BYTES_LIMIT = 200 * 1024

/** 当前文件内容状态：ok 可编辑；truncated 被接口截断；unsupported 内容不可信（未返回该文件 / 编码不一致） */
type ContentState = 'ok' | 'truncated' | 'unsupported'

/** 文件树节点（由后端返回的扁平相对路径还原） */
interface TreeNode {
  name: string
  path: string
  isDir: boolean
  size: number
  updatedAt: string
  editable: boolean
  children: TreeNode[]
}

/** 文件树展开后的一行（目录可折叠） */
interface TreeRow {
  name: string
  path: string
  isDir: boolean
  size: number
  updatedAt: string
  editable: boolean
  depth: number
  expanded: boolean
  /** 文件的启用状态：true 启用 / false 停用 / null 未知（还没看过这个文件） */
  enabled: boolean | null
  /** 目录：这一支下面已知被停用的文件数（0 = 没有或未知） */
  disabledCount: number
}

// 页面打开时
onMounted(() => {
  loadOverview()
  loadList(true)
})

/**
 * Data Setting
 * 数据配置
 */
// 概览（目录路径、harness、开发模式状态）
const overview = ref<AssetOverview | null>(null)
// 条目列表
const items = ref<AssetItem[]>([])
// 列表加载
const listLoading = ref(false)
// 刷新按钮加载
const refreshing = ref(false)
// 关键字（在前端按名称/标题/描述过滤）
const keyword = ref('')
// 当前选中条目名
const activeName = ref('')
// 条目详情
const detail = ref<AssetDetail | null>(null)
// 详情加载
const detailLoading = ref(false)
// 当前查看的文件（条目内相对路径）
const activeFile = ref('')
// 当前文件内容
const fileContent = ref('')
// 主文档内容（详情接口不传 file 时直接返回）
const docContent = ref('')
// 当前文件内容状态
const contentState = ref<ContentState>('ok')
// 文件内容加载
const fileLoading = ref(false)
// 已折叠的目录
const collapsedDirs = ref<Set<string>>(new Set())
// 是否处于编辑态
const isEditing = ref(false)
// 编辑中的内容
const editContent = ref('')
// 保存中
const saving = ref(false)
// 新建弹窗显隐
const createVisible = ref(false)
// 新建中
const creating = ref(false)
// 新建表单
const createForm = ref({ name: '', title: '' })
// 当前条目的启用状态（详情头部开关的初值与回滚依据，跟随当前查看的文件）
const enabledValue = ref(true)
// 每个文件的启用状态缓存：详情接口只返回「当前文件」的 enabled，看过的文件记下来，
// 没看过的显示为未知（不猜），避免把「没数据」误报成「已停用」
const fileEnabledMap = ref<Record<string, boolean>>({})
// 启用 / 停用请求中
const enabledLoading = ref(false)
// AI 润色中（同步接口，可能几十秒）
const isPolishing = ref(false)
// 新建目录 / 文件弹窗
const nodeVisible = ref(false)
// 新建目录 / 文件中
const nodeCreating = ref(false)
// 新建表单：nodeType = dir / file，parent = 条目内相对目录（'' = 条目根目录）
const nodeForm = ref<{ nodeType: 'dir' | 'file'; parent: string; nodeName: string }>({
  nodeType: 'file',
  parent: '',
  nodeName: ''
})

/**
 * Computed Setting
 * 计算配置
 */

/** 当前资产类型的中文名 */
const kindLabel = computed(() => {
  if (props.kind === 'agent') return t('agentAdmin.kindAgent')
  if (props.kind === 'tool') return t('agentAdmin.kindTool')
  return t('agentAdmin.kindSkill')
})

/** 卡片标题 */
const panelTitle = computed(() => {
  if (props.kind === 'agent') return t('agentAdmin.agentTitle')
  if (props.kind === 'tool') return t('agentAdmin.toolTitle')
  return t('agentAdmin.skillTitle')
})

/** 当前类型的主文档名，用于新建提示 */
const docNameOfKind = computed(() => {
  if (props.kind === 'agent') return 'AGENT.md'
  if (props.kind === 'tool') return 'TOOL.md'
  return 'SKILL.md'
})

/** 后台目录（概览返回） */
const kindRoot = computed(() => overview.value?.roots?.[props.kind] ?? '')
const harnessPresent = computed(() => !!overview.value?.harness?.present)
const harnessVersion = computed(() => overview.value?.harness?.version ?? '-')
const dshReady = computed(() => !!overview.value?.dsh?.ready)
const dshHint = computed(() => overview.value?.dsh?.hint || t('agentAdmin.dshNotReady'))

/** 关键字过滤后的条目列表 */
const filteredItems = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  if (!key) return items.value

  return items.value.filter((item) =>
    `${item.name} ${item.title} ${item.description}`.toLowerCase().includes(key)
  )
})

/** 当前查看文件的元信息 */
const activeFileMeta = computed<AssetFile | undefined>(() =>
  (detail.value?.files || []).find((file) => file.path === activeFile.value)
)

/** 是否允许编辑：文件可编辑且内容可信 */
const canEdit = computed(() => contentState.value === 'ok' && !!activeFileMeta.value?.editable)

/** 是否有未保存的修改 */
const isDirty = computed(() => isEditing.value && editContent.value !== fileContent.value)

/** 文件树 */
const fileTree = computed<TreeNode[]>(() => buildTree(detail.value?.files || []))

/** 某个文件是否已知被停用（只有真的看过它才返回 true / false，否则 null = 未知） */
function fileEnabledState(path: string): boolean | null {
  if (path === activeFile.value) return enabledValue.value
  const known = fileEnabledMap.value[path]
  return typeof known === 'boolean' ? known : null
}

/** 目录下已知被停用的文件数（未知的不计入，避免误报） */
function countDisabledFiles(path: string): number {
  const prefix = `${path}/`
  return Object.entries(fileEnabledMap.value).filter(
    ([key, enabled]) => enabled === false && key.startsWith(prefix)
  ).length
}

/** 文件树展开后的行 */
const fileRows = computed<TreeRow[]>(() => {
  const rows: TreeRow[] = []

  const walk = (nodes: TreeNode[], depth: number) => {
    nodes.forEach((node) => {
      const expanded = !collapsedDirs.value.has(node.path)
      rows.push({
        name: node.name,
        path: node.path,
        isDir: node.isDir,
        size: node.size,
        updatedAt: node.updatedAt,
        editable: node.editable,
        depth,
        expanded,
        enabled: node.isDir ? null : fileEnabledState(node.path),
        disabledCount: node.isDir ? countDisabledFiles(node.path) : 0
      })
      if (node.isDir && expanded) walk(node.children, depth + 1)
    })
  }

  walk(fileTree.value, 0)
  return rows
})

/** 详情里所有文件的总大小与最近更新时间 */
const detailSize = computed(() =>
  (detail.value?.files || []).reduce((total, file) => total + file.size, 0)
)
const detailUpdatedAt = computed(() =>
  (detail.value?.files || []).reduce(
    (latest, file) => (file.updatedAt > latest ? file.updatedAt : latest),
    ''
  )
)

/** 内容异常提示（主文档缺失 / 内容被截断 / 内容不可信） */
const contentAlert = computed(() => {
  if (!detail.value) return ''
  if (!detail.value.hasDoc) return t('agentAdmin.noDocTip')
  if (contentState.value === 'truncated') return t('agentAdmin.fileTruncated')
  if (contentState.value === 'unsupported') return t('agentAdmin.fileContentUnavailable')
  return ''
})

/** 代码区展示的内容 */
const displayContent = computed(() => {
  if (contentState.value === 'unsupported') return t('agentAdmin.fileContentUnavailable')
  return fileContent.value || t('agentAdmin.emptyContent')
})

/** 启用开关的悬浮提示：说明点了会发生什么（只改当前文件），或为什么点不了 */
const enabledTip = computed(() => {
  if (isEditing.value) return t('agentAdmin.enabledEditingTip')
  if (isPolishing.value) return t('agentAdmin.enabledPolishingTip')
  const file = activeFile.value || detail.value?.docName || ''
  return t('agentAdmin.enabledFileTip', { file: file || '-' })
})

/**
 * Method Setting
 * 方法配置
 */

/** 字节格式化：1536 -> 1.50 KB */
function formatBytes(bytes?: number | null): string {
  const value = Number(bytes)
  if (!Number.isFinite(value)) return '-'
  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB']
  let size = value
  let index = -1
  do {
    size = size / 1024
    index += 1
  } while (size >= 1024 && index < units.length - 1)

  return `${size.toFixed(2)} ${units[index]}`
}

/** 时间格式化：ISO -> YYYY-MM-DD HH:mm:ss */
function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 文本字节数：用来核对接口返回的内容是不是目标文件的真实内容 */
function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length
}

/** 耗时格式化：12500 -> 12.5s（润色可能耗时几十秒，用秒展示更好读） */
function formatDuration(ms?: number | null): string {
  const value = Number(ms)
  if (!Number.isFinite(value) || value < 0) return '-'
  if (value < 1000) return `${Math.round(value)}ms`
  return `${(value / 1000).toFixed(1)}s`
}

/**
 * Resolve Content State
 * 判定本次返回的内容是否可信
 *
 * 详情接口会把本次返回内容对应的文件回显在 file 字段里：
 * 请求了非主文档却拿到别的文件，说明内容不是目标文件的，直接禁用编辑；
 * 内容字节数与文件清单里的 size 对不上且超过接口上限，说明被截断了，同样禁用编辑。
 */
function resolveContentState(
  content: string,
  target: AssetFile | undefined,
  returnedFile: string,
  requestedFile: string
): ContentState {
  if (!target) return 'unsupported'
  if (requestedFile && returnedFile && returnedFile !== requestedFile) return 'unsupported'

  const size = utf8Size(content)
  if (size === target.size) return 'ok'
  if (size >= CONTENT_BYTES_LIMIT || target.size >= CONTENT_BYTES_LIMIT) return 'truncated'
  return 'unsupported'
}

/**
 * Build Tree
 * 把后端返回的扁平文件清单还原成目录树
 */
function buildTree(files: AssetFile[]): TreeNode[] {
  const root: TreeNode = {
    name: '',
    path: '',
    isDir: true,
    size: 0,
    updatedAt: '',
    editable: false,
    children: []
  }
  const dirMap = new Map<string, TreeNode>([['', root]])

  /** 逐级创建目录节点 */
  const ensureDir = (segments: string[]): TreeNode => {
    let parent = root
    let current = ''

    segments.forEach((segment) => {
      current = current ? `${current}/${segment}` : segment
      let node = dirMap.get(current)
      if (!node) {
        node = {
          name: segment,
          path: current,
          isDir: true,
          size: 0,
          updatedAt: '',
          editable: false,
          children: []
        }
        dirMap.set(current, node)
        parent.children.push(node)
      }
      parent = node
    })

    return parent
  }

  files.forEach((file) => {
    const segments = String(file.path || '').split('/').filter(Boolean)
    if (!segments.length) return

    // 目录本身（后端把目录也列进 files 时，editable=false 的目录项走到这里）
    if (segments.length === 1 && !file.editable && !String(file.name || '').includes('.')) {
      ensureDir(segments)
      return
    }

    const fileName = segments.pop()
    if (!fileName) return

    ensureDir(segments).children.push({
      name: fileName,
      path: file.path,
      isDir: false,
      size: file.size,
      updatedAt: file.updatedAt,
      editable: file.editable,
      children: []
    })
  })

  /** 目录在前，同级按名称排序 */
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((prev, next) =>
      prev.isDir === next.isDir ? prev.name.localeCompare(next.name) : prev.isDir ? -1 : 1
    )
    nodes.forEach((node) => sortNodes(node.children))
  }
  sortNodes(root.children)

  return root.children
}

/**
 * Confirm Discard
 * 有未保存修改时二次确认，确认后再执行切换
 * @param action 确认后要执行的动作
 */
function confirmDiscard(action: () => void) {
  if (!isDirty.value) {
    action()
    return
  }

  const dialog = DialogPlugin.confirm({
    header: t('agentAdmin.unsavedTitle'),
    body: t('agentAdmin.unsavedConfirm'),
    theme: 'warning',
    confirmBtn: { content: t('common.confirm') },
    onConfirm: () => {
      isEditing.value = false
      editContent.value = ''
      action()
      dialog.hide()
    }
  })
}

/**
 * Get Overview
 * 获取概览：目录路径 + harness / 开发模式状态
 */
async function loadOverview() {
  try {
    const res = await props.api.getOverview()
    if (res.code === 2000) {
      overview.value = res.data as AssetOverview
    } else {
      MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.loadFailed'))
    }
  } catch {
    // 网络异常已由请求拦截器统一提示
  }
}

/**
 * Get List
 * 获取条目列表
 * @param autoSelect 是否在没有任何选中项时自动选中第一条
 */
async function loadList(autoSelect = false) {
  listLoading.value = true
  try {
    const res = await props.api.getAssetList()
    if (res.code === 2000) {
      items.value = (res.data?.items || []) as AssetItem[]
    } else {
      MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.loadFailed'))
    }

    // 当前条目已被删除时清空右侧
    if (activeName.value && !items.value.some((item) => item.name === activeName.value)) {
      activeName.value = ''
      detail.value = null
    }

    if (autoSelect && !activeName.value) {
      const first = items.value[0]
      if (first) await selectItem(first.name)
    }
  } catch {
    // 网络异常已由请求拦截器统一提示
  } finally {
    listLoading.value = false
  }
}

/**
 * Get Detail
 * 获取条目详情（主文档 + 文件清单），并默认展示主文档
 * @param name 条目名称
 * @param keepFile 是否保留当前正在查看的文件（润色 / 启用后刷新内容时用，避免跳回主文档）
 * @param keepDirs 是否保留目录展开状态（新建节点后刷新时用，保证新节点可见）
 */
async function loadDetail(name: string, keepFile = false, keepDirs = false) {
  detailLoading.value = true
  try {
    const res = await props.api.getAssetDetail(name)
    if (res.code !== 2000) {
      MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.loadFailed'))
      detail.value = null
      return
    }

    const data = res.data as AssetDetail
    const files = data.files || []
    const target = files.find((file) => file.path === data.docName) ?? files[0]
    const previous = activeFile.value
    // 刷新后原文件还在就继续停留（仅刷新内容），否则回到主文档
    const kept = keepFile && previous && files.some((file) => file.path === previous) ? previous : ''

    detail.value = data
    // detail.enabled 是后端按「本次请求的那个文件」算出来的：不带 file 时就是主文档
    rememberFileEnabled(data.file || data.docName, data.enabled !== false)
    docContent.value = String(data.content ?? '')
    fileContent.value = ''
    contentState.value = 'ok'
    if (!keepDirs) collapsedDirs.value = new Set()
    activeFile.value = kept || target?.path || ''
    // 开关跟随当前正在查看的文件
    enabledValue.value = fileEnabledState(activeFile.value) !== false

    if (activeFile.value) await loadFileContent(activeFile.value)
  } catch {
    // 网络异常已由请求拦截器统一提示
  } finally {
    detailLoading.value = false
  }
}

/** 记下一个文件的启用状态（详情接口一次只返回一个文件的状态） */
function rememberFileEnabled(path: string, enabled: boolean) {
  const key = String(path || '').trim()
  if (!key) return
  fileEnabledMap.value = { ...fileEnabledMap.value, [key]: enabled }
}

/**
 * Get File Content
 * 读取条目内某个文件的内容（主文档已随详情返回，不再重复请求）
 * @param path 条目内相对路径
 */
async function loadFileContent(path: string) {
  const current = detail.value
  if (!current) return

  if (path === current.docName) {
    fileContent.value = docContent.value
    contentState.value = resolveContentState(docContent.value, activeFileMeta.value, path, path)
    return
  }

  fileLoading.value = true
  try {
    const res = await props.api.getAssetDetail(current.name, path)
    if (res.code !== 2000) {
      MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.loadFailed'))
      fileContent.value = ''
      contentState.value = 'unsupported'
      return
    }

    const data = res.data as AssetDetail
    const content = String(data.content ?? '')
    const target = (data.files || []).find((file) => file.path === path)

    // 详情接口同时返回「这个文件」的启用状态，顺手记下来供文件树标记使用
    rememberFileEnabled(data.file || path, data.enabled !== false)
    if (path === activeFile.value) enabledValue.value = data.enabled !== false

    fileContent.value = content
    contentState.value = resolveContentState(content, target, String(data.file ?? ''), path)
  } catch {
    // 网络异常已由请求拦截器统一提示
  } finally {
    fileLoading.value = false
  }
}

/**
 * Select Item
 * 选中条目（切换前若有未保存修改先确认）
 * @param item 列表项
 */
function handleSelectItem(item: AssetItem) {
  if (item.name === activeName.value) return
  confirmDiscard(() => {
    void selectItem(item.name)
  })
}

/** 选中条目并加载详情 */
async function selectItem(name: string) {
  activeName.value = name
  isEditing.value = false
  editContent.value = ''
  await loadDetail(name)
}

/**
 * Select File
 * 点文件切换查看；点目录折叠 / 展开
 * @param row 文件树行
 */
function handleSelectFile(row: TreeRow) {
  if (row.isDir) {
    const next = new Set(collapsedDirs.value)
    if (next.has(row.path)) next.delete(row.path)
    else next.add(row.path)
    collapsedDirs.value = next
    return
  }

  if (row.path === activeFile.value) return
  confirmDiscard(() => {
    void switchFile(row.path)
  })
}

/** 切换当前查看的文件 */
async function switchFile(path: string) {
  isEditing.value = false
  editContent.value = ''
  activeFile.value = path
  await loadFileContent(path)
}

/** 进入编辑态 */
function handleStartEdit() {
  if (!canEdit.value) return
  editContent.value = fileContent.value
  isEditing.value = true
}

/** 取消编辑 */
function handleCancelEdit() {
  isEditing.value = false
  editContent.value = ''
}

/**
 * Save File
 * 保存当前查看的文件内容
 */
async function handleSave() {
  const current = detail.value
  const file = activeFile.value
  if (!current || !file) return

  saving.value = true
  try {
    const res = await props.api.saveAssetFile({
      name: current.name,
      file,
      content: editContent.value
    })
    if (res.code === 2000) {
      MessagePlugin.success(t('agentAdmin.saveSuccess'))
      isEditing.value = false
      // 重新拉取详情与列表，让文件大小、更新时间同步
      await Promise.all([loadDetail(current.name), loadList()])
    } else {
      MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.saveFailed'))
    }
  } catch {
    MessagePlugin.error(t('agentAdmin.saveRetry'))
  } finally {
    saving.value = false
  }
}

/**
 * Set Enabled
 * 启用 / 停用「当前正在查看的文件」：状态写进该文件顶部的 front matter，
 * 失败时把开关回滚到原状态，成功后再刷新当前文件详情与列表（列表仍是主文档状态）
 * @param value 开关切换后的新状态（t-switch 默认是布尔值）
 */
async function handleToggleEnabled(value: string | number | boolean) {
  const current = detail.value
  if (!current || enabledLoading.value) return

  const file = activeFile.value || current.file || current.docName
  const target = value === true
  enabledLoading.value = true
  try {
    const res = await props.api.setAssetEnabled({ name: current.name, enabled: target, file })
    if (res.code !== 2000) {
      // 失败：回滚开关，别让界面显示一个并没有生效的状态
      enabledValue.value = !target
      MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.enableFailed'))
      return
    }

    const enabled = res.data?.enabled !== false
    enabledValue.value = enabled
    rememberFileEnabled(file, enabled)
    MessagePlugin.success(t(enabled ? 'agentAdmin.enableSuccess' : 'agentAdmin.disableSuccess'))
    // 列表上的停用标记要跟着变（列表项表示主文档状态）
    await loadList()
    // 当前文件被写入了 front matter，内容同步刷新并保留当前文件；编辑中则跳过，避免覆盖未保存的修改
    if (!isEditing.value && activeName.value === current.name) await loadDetail(current.name, true)
  } catch {
    enabledValue.value = !target
    MessagePlugin.error(t('agentAdmin.enableFailed'))
  } finally {
    enabledLoading.value = false
  }
}

/**
 * Polish File
 * AI 润色当前正在查看的文件：二次确认后调用同步接口，完成后重新拉取该文件内容
 */
function handlePolish() {
  const current = detail.value
  const file = activeFile.value
  if (!current || !file || isPolishing.value || isEditing.value) return

  const dialog = DialogPlugin.confirm({
    header: t('agentAdmin.polishConfirmTitle'),
    body: t('agentAdmin.polishConfirmBody', { file }),
    theme: 'warning',
    confirmBtn: { content: t('agentAdmin.polish') },
    // 同步接口要跑几十秒，期间不允许通过关闭按钮 / 遮罩 / Esc 把它关掉造成误以为已取消
    closeBtn: false,
    closeOnOverlayClick: false,
    closeOnEscKeydown: false,
    onConfirm: async () => {
      dialog.update({ confirmBtn: { content: t('agentAdmin.polishRunning'), loading: true } })
      isPolishing.value = true
      const startedAt = Date.now()
      try {
        const res = await props.api.polishAsset({ name: current.name, file })
        const data = (res?.data ?? {}) as AssetPolishResult
        if (res?.code !== 2000) {
          MessagePlugin.error(res?.message ?? res?.msg ?? t('agentAdmin.polishFailed'))
        } else if (data.ok === false) {
          MessagePlugin.error(data.error || t('agentAdmin.polishFailed'))
        } else {
          MessagePlugin.success(
            t('agentAdmin.polishSuccess', {
              duration: formatDuration(data.duration ?? Date.now() - startedAt)
            })
          )
          // 磁盘上的文件已被改写，重新拉取当前文件内容与文件清单
          await loadDetail(current.name, true)
          await loadList()
        }
      } catch {
        MessagePlugin.error(t('agentAdmin.polishRetry'))
      } finally {
        isPolishing.value = false
        dialog.hide()
      }
    }
  })
}

/** 打开新建弹窗 */
function openCreateDialog() {
  createForm.value = { name: '', title: '' }
  createVisible.value = true
}

/**
 * Create Asset
 * 新建条目：校验名称后由后端按模板生成主文档
 */
async function handleCreate() {
  const name = createForm.value.name.trim()
  if (!name) {
    MessagePlugin.error(t('agentAdmin.nameRequired'))
    return
  }
  if (!NAME_PATTERN.test(name)) {
    MessagePlugin.error(t('agentAdmin.nameInvalid'))
    return
  }

  creating.value = true
  try {
    const title = createForm.value.title.trim()
    const res = await props.api.createAsset({ name, title: title || undefined })
    if (res.code === 2000) {
      MessagePlugin.success(t('agentAdmin.createSuccess'))
      createVisible.value = false
      await Promise.all([loadList(), loadOverview()])
      await selectItem(name)
    } else {
      MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.createFailed'))
    }
  } catch {
    MessagePlugin.error(t('agentAdmin.createRetry'))
  } finally {
    creating.value = false
  }
}

/**
 * Create Node
 * 在条目目录里新建目录 / 文件：位置 = 当前选中的目录（选中文件用它的父目录；都没选就是条目根目录）
 */

/** 当前选中的目录：选中目录就用它，选中文件就用它的父目录，都没选就是条目根目录 */
const currentNodeParent = computed(() => {
  const path = activeFile.value
  if (!path) return ''
  const meta = activeFileMeta.value
  if (!meta && detail.value && path === detail.value.docName) return ''
  // 文件一定在文件清单里；不在清单里说明是目录路径
  if (meta) {
    const index = path.lastIndexOf('/')
    return index > 0 ? path.slice(0, index) : ''
  }
  return path
})

/** 打开新建弹窗（先记下创建位置，避免弹窗打开后界面切换导致位置变化） */
function openNodeDialog(nodeType: 'dir' | 'file') {
  if (!detail.value) return
  nodeForm.value = { nodeType, parent: currentNodeParent.value, nodeName: '' }
  nodeVisible.value = true
}

/** 把名称补成合法文件名：没有后缀时补 .md */
function normalizeNodeName(nodeType: 'dir' | 'file', raw: string): string {
  const name = raw.trim()
  if (nodeType === 'dir') return name
  if (!name || name.endsWith('.')) return name
  return FILE_EXT_PATTERN.test(name) ? name : `${name}${DEFAULT_FILE_EXT}`
}

/** 新建目录 / 文件：校验名称后调接口，成功后刷新详情并选中 / 展开新节点 */
async function handleCreateNode() {
  const current = detail.value
  if (!current) return

  const { nodeType, parent } = nodeForm.value
  const nodeName = normalizeNodeName(nodeType, nodeForm.value.nodeName)
  if (!nodeName) {
    MessagePlugin.error(t('agentAdmin.nodeNameRequired'))
    return
  }
  if (!NAME_PATTERN.test(nodeName) || nodeName.includes('..')) {
    MessagePlugin.error(t('agentAdmin.nodeNameInvalid'))
    return
  }

  nodeCreating.value = true
  try {
    const res = await props.api.createAssetNode({ name: current.name, parent, nodeType, nodeName })
    if (res.code === 2000) {
      const created = String(res.data?.path || (parent ? `${parent}/${nodeName}` : nodeName))
      MessagePlugin.success(t('agentAdmin.nodeCreateSuccess', { path: created }))
      nodeVisible.value = false
      // 新节点要看得见：目录保持展开、新文件选中
      await loadDetail(current.name, false, true)
      if (nodeType === 'file') await switchFile(created)
      else {
        const next = new Set(collapsedDirs.value)
        next.delete(created)
        collapsedDirs.value = next
      }
    } else {
      MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.nodeCreateFailed'))
    }
  } catch {
    MessagePlugin.error(t('agentAdmin.nodeCreateRetry'))
  } finally {
    nodeCreating.value = false
  }
}

/**
 * Remove Asset
 * 删除条目：二次确认后连同目录内全部文件一起删除
 */
function handleRemove() {
  const current = detail.value
  if (!current) return

  const dialog = DialogPlugin.confirm({
    header: t('agentAdmin.removeTitle'),
    body: t('agentAdmin.removeBody', { name: current.name }),
    theme: 'danger',
    confirmBtn: { content: t('agentAdmin.removeConfirm'), theme: 'danger' },
    onConfirm: async () => {
      dialog.update({ confirmBtn: { loading: true, content: t('common.deleting'), theme: 'danger' } })
      try {
        const res = await props.api.removeAsset(current.name)
        if (res.code === 2000) {
          MessagePlugin.success(t('agentAdmin.removeSuccess'))
          activeName.value = ''
          detail.value = null
          isEditing.value = false
          editContent.value = ''
          await Promise.all([loadList(true), loadOverview()])
        } else {
          MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.removeFailed'))
        }
      } catch {
        MessagePlugin.error(t('agentAdmin.removeRetry'))
      } finally {
        dialog.hide()
      }
    }
  })
}

/**
 * Refresh
 * 刷新概览、列表与当前条目详情
 */
async function handleRefresh() {
  refreshing.value = true
  try {
    await Promise.all([loadOverview(), loadList()])
    if (activeName.value) await loadDetail(activeName.value)
  } finally {
    refreshing.value = false
  }
}
</script>

<style lang="scss" scoped>@import url("./index.scss");</style>

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
              <!-- AI 润色：异步接口，提交后轮询进度，按钮上显示已等待秒数 -->
              <t-button
                size="small"
                variant="outline"
                :loading="isPolishing"
                :disabled="isEditing || !activeFile || !!activeDir"
                data-testid="asset-polish"
                @click="handlePolish"
              >
                {{ isPolishing
                  ? $t('agentAdmin.polishRunningSeconds', { seconds: polishSeconds })
                  : $t('agentAdmin.polish') }}
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
              <!-- 删除：只删「当前选中的那一个节点」；没有选中时禁用，绝不退化成删除整个条目 -->
              <t-tooltip :content="selectedNode ? $t('agentAdmin.removeNodeTip', { path: selectedNode.path }) : $t('agentAdmin.removeDisabledTip')">
                <t-button
                  size="small"
                  theme="danger"
                  variant="outline"
                  data-testid="asset-node-remove"
                  :disabled="!selectedNode"
                  @click="handleRemoveNode"
                >
                  {{ selectedNode?.isDir ? $t('agentAdmin.removeDir') : $t('agentAdmin.removeFile') }}
                  <template #icon>
                    <DeleteIcon />
                  </template>
                </t-button>
              </t-tooltip>
              <!-- 删除整个条目：破坏性最大，收进「更多」，不再是工具栏默认动作 -->
              <t-dropdown
                trigger="click"
                placement="bottom-right"
                :options="moreOptions"
                data-testid="asset-more-menu"
              >
                <t-button size="small" variant="outline" data-testid="asset-more-trigger">
                  {{ $t('agentAdmin.more') }}
                  <template #icon>
                    <EllipsisIcon />
                  </template>
                </t-button>
              </t-dropdown>
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
                    'asset-panel__node--active': row.path === activeFile,
                    'asset-panel__node--dir': row.isDir,
                    'asset-panel__node--off': !row.isDir && row.enabled === false
                  }"
                  :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
                  :title="row.path"
                  :data-testid="row.isDir ? 'asset-node-dir' : 'asset-node-file'"
                  :data-node-path="row.path"
                  :data-node-kind="row.isDir ? 'dir' : 'file'"
                  :data-node-selected="row.path === activeFile ? 'true' : 'false'"
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
                <!-- 选中目录时明确说是「当前目录」（新建的位置），不要把它当成文件显示 -->
                <template v-if="activeDir">
                  <span class="asset-panel__content-dir" data-testid="asset-current-dir" :title="activeDir">
                    {{ $t('agentAdmin.currentDir', { path: `${activeDir}/` }) }}
                  </span>
                  <span class="asset-panel__content-meta">
                    <t-tag theme="primary" variant="light" size="small" data-testid="asset-current-dir-tag">
                      {{ $t('agentAdmin.nodeCreateHere') }}
                    </t-tag>
                  </span>
                </template>
                <template v-else>
                  <span class="asset-panel__content-file" data-testid="asset-current-file">
                    {{ activeFile || $t('agentAdmin.noFile') }}
                  </span>
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
                </template>
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

  <!-- 删除单个节点：目录走重度提醒（红底 + 必须勾选确认），文件走普通确认 -->
  <t-dialog
    v-model:visible="removeNodeVisible"
    placement="center"
    :theme="removeNodeForm.isDir ? 'danger' : 'default'"
    :header="removeNodeForm.isDir ? $t('agentAdmin.removeDirTitle') : $t('agentAdmin.removeFileTitle')"
    :confirm-btn="removeNodeConfirmBtn"
    :cancel-btn="{ content: $t('common.cancel') }"
    :close-on-overlay-click="false"
    :close-on-esc-keydown="false"
    @confirm="handleConfirmRemoveNode"
  >
    <div class="asset-panel__danger" data-testid="asset-remove-node-dialog">
      <template v-if="removeNodeForm.isDir">
        <div class="asset-panel__danger-title" data-testid="asset-remove-dir-note">
          {{ $t('agentAdmin.removeDirHeavy') }}
        </div>
        <div class="asset-panel__danger-path">{{ removeNodeForm.path }}/</div>
        <div class="asset-panel__danger-list">
          <div>{{ $t('agentAdmin.removeDirBody', { path: `${removeNodeForm.path}/` }) }}</div>
          <div>{{ $t('agentAdmin.removeDirIrreversible') }}</div>
        </div>
        <t-checkbox
          v-model="removeNodeForm.ackDir"
          data-testid="asset-remove-ack"
          :disabled="removeNodeSubmitting"
        >
          {{ $t('agentAdmin.removeDirAck') }}
        </t-checkbox>
      </template>
      <template v-else>
        <div class="asset-panel__danger-path">{{ removeNodeForm.path }}</div>
        <div class="asset-panel__danger-list">
          <div>{{ $t('agentAdmin.removeFileBody', { path: removeNodeForm.path }) }}</div>
        </div>
      </template>
    </div>
  </t-dialog>

  <!-- 删除整个条目：同样走重度提醒，必须勾选确认 -->
  <t-dialog
    v-model:visible="removeItemVisible"
    placement="center"
    theme="danger"
    :header="$t('agentAdmin.removeItemTitle')"
    :confirm-btn="removeItemConfirmBtn"
    :cancel-btn="{ content: $t('common.cancel') }"
    :close-on-overlay-click="false"
    :close-on-esc-keydown="false"
    @confirm="handleConfirmRemoveItem"
  >
    <div class="asset-panel__danger" data-testid="asset-remove-item-dialog">
      <div class="asset-panel__danger-title">{{ $t('agentAdmin.removeItemHeavy') }}</div>
      <div class="asset-panel__danger-path">{{ removeItemForm.name }}/</div>
      <div class="asset-panel__danger-list">
        <div>{{ $t('agentAdmin.removeItemBody', { name: removeItemForm.name }) }}</div>
        <div>{{ $t('agentAdmin.removeItemIrreversible') }}</div>
      </div>
      <t-checkbox
        v-model="removeItemForm.ackItem"
        data-testid="asset-remove-item-ack"
        :disabled="removeItemSubmitting"
      >
        {{ $t('agentAdmin.removeItemAck') }}
      </t-checkbox>
    </div>
  </t-dialog>
</template>

<script lang="ts">
export default { name: 'AgentAdminAssetPanel' }
</script>

<script lang="ts" setup>
// 1. 第三方依赖
import { computed, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  EllipsisIcon,
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
  AssetPolishAccepted,
  AssetPolishStatus
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

/** 润色进度轮询间隔：1 秒一次，刚好和按钮上的秒数同步 */
const POLISH_POLL_INTERVAL_MS = 1000

/**
 * 润色进度轮询上限
 *
 * 后端单次润色的超时是 8 分钟，这里给 10 分钟：正常的偶发慢一点不会被前端提前放弃，
 * 但也不会无限轮询下去（到点保留提示，用户可刷新查看）。
 */
const POLISH_POLL_MAX_MS = 10 * 60 * 1000

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

// 卸载时停掉润色计时器，避免定时器在已销毁的组件上继续跑
onBeforeUnmount(() => {
  stopPolishTimer()
  isPolishing.value = false
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
// AI 润色中（异步：提交后轮询进度）
const isPolishing = ref(false)
/** 已等待秒数：显示在按钮上（「润色中… 37s」），让人知道它真的在跑 */
const polishSeconds = ref(0)
/** 润色前的文件字节数：用来判断是否真的被改写 */
const polishBeforeSize = ref<number | null>(null)
/** 「已等待秒数」计时器 */
let polishTimer = 0
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
// 删除单个节点弹窗（目录必勾选确认，文件普通确认）
const removeNodeVisible = ref(false)
const removeNodeSubmitting = ref(false)
const removeNodeForm = ref<{ path: string; isDir: boolean; ackDir: boolean }>({
  path: '',
  isDir: false,
  ackDir: false
})
// 删除整个条目弹窗（重度提醒，必勾选确认）
const removeItemVisible = ref(false)
const removeItemSubmitting = ref(false)
const removeItemForm = ref<{ name: string; ackItem: boolean }>({ name: '', ackItem: false })

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

/**
 * 当前选中的目录（'' = 没选中目录）
 *
 * activeFile 既可能是一个文件路径，也可能是一个目录路径。
 * 目录集合直接取自还原出来的文件树，不再靠「文件清单里有没有」来猜——
 * 后端会把目录也列进 files（带 type: 'dir'），因此那个猜测会把目录误判成文件。
 */
const dirPathSet = computed(() => {
  const set = new Set<string>()
  const walk = (nodes: TreeNode[]) => {
    nodes.forEach((node) => {
      if (!node.isDir) return
      set.add(node.path)
      walk(node.children)
    })
  }
  walk(fileTree.value)
  return set
})

const activeDir = computed(() => (dirPathSet.value.has(activeFile.value) ? activeFile.value : ''))

/**
 * 当前选中的节点：删除按钮和「将创建于」都以它为准
 *
 * 没选中任何节点时为 null —— 此时删除按钮必须禁用，绝不能退化成删除整个条目。
 */
const selectedNode = computed<{ path: string; isDir: boolean; name: string } | null>(() => {
  const path = activeFile.value
  if (!path) return null
  const segments = path.split('/')
  const name = segments[segments.length - 1] || path
  if (activeDir.value) return { path, isDir: true, name }
  return { path, isDir: false, name }
})

/** 目录删除的确认按钮：未勾选确认框时保持禁用 */
const removeNodeConfirmBtn = computed(() => {
  const needAck = removeNodeForm.value.isDir
  return {
    content: removeNodeForm.value.isDir
      ? t('agentAdmin.removeDirConfirm')
      : t('agentAdmin.removeFileConfirm'),
    theme: 'danger' as const,
    loading: removeNodeSubmitting.value,
    disabled: needAck && !removeNodeForm.value.ackDir
  }
})

/** 整个条目删除的确认按钮：未勾选确认框时保持禁用 */
const removeItemConfirmBtn = computed(() => ({
  content: t('agentAdmin.removeItemConfirm'),
  theme: 'danger' as const,
  loading: removeItemSubmitting.value,
  disabled: !removeItemForm.value.ackItem
}))

/** 「更多」菜单：破坏性最大的「删除整个条目」只在这里出现 */
const moreOptions = computed(() => [
  {
    content: t('agentAdmin.moreRemoveItem'),
    theme: 'error' as const,
    value: 'remove-item',
    onClick: () => openRemoveItem()
  }
])

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
  // 选中的是目录：这里没有文件内容，直接说清它是什么、能做什么
  if (activeDir.value) return t('agentAdmin.currentDirHint', { path: `${activeDir.value}/` })
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

    // 目录本身：以后端返回的 type 为准（后端会把目录也列进 files，否则空目录不可见）
    const isDirEntry = file.type === 'dir' ||
      (file.type === undefined && !file.editable && !String(file.name || '').includes('.'))
    if (isDirEntry) {
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
    // 默认展示主文档；主文档缺失时也绝不落到目录项上（目录没有内容可看）
    const target = files.find((file) => file.path === data.docName) ??
      files.find((file) => file.type !== 'dir') ??
      files[0]
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

  // 目录没有文件内容可读：直接清空内容区，由 activeDir 分支展示「已选择目录」
  if (dirPathSet.value.has(path)) {
    fileContent.value = ''
    contentState.value = 'ok'
    return
  }

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
    // 目录：折叠 / 展开，并把它选为「当前目录」（新建文件/目录就建在它里面）
    const next = new Set(collapsedDirs.value)
    if (next.has(row.path)) next.delete(row.path)
    else next.add(row.path)
    collapsedDirs.value = next

    // 选中目录不涉及切换文件内容，因此不必走「放弃未保存修改」的确认，
    // 否则有未保存修改时会出现「点了没反应」，让人以为目录选不中
    activeFile.value = row.path
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
/**
 * Polish File
 * AI 润色当前正在查看的文件
 *
 * 后端已改成异步：提交后立刻拿到 runId，这里轮询进度并把「已等待多少秒」显示在按钮上。
 * 这样既不会因为等两分钟而被误判为失败，也能把「后端已有任务在执行」如实提示出来。
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
    // 一次润色约 100 秒，期间不允许通过关闭按钮 / 遮罩 / Esc 关掉造成「已取消」的误解
    closeBtn: false,
    closeOnOverlayClick: false,
    closeOnEscKeydown: false,
    onConfirm: async () => {
      isPolishing.value = true
      polishSeconds.value = 0
      polishTimer = window.setInterval(() => {
        polishSeconds.value += 1
      }, 1000)

      // 弹窗先关掉：进度显示在工具栏按钮上（「润色中… 37s」），不挡着看文件
      dialog.hide()

      try {
        const res = await props.api.polishAsset({ name: current.name, file })
        const accepted = (res?.data ?? {}) as AssetPolishAccepted
        if (res?.code !== 2000 || !accepted.started || !accepted.runId) {
          MessagePlugin.error(res?.message ?? res?.msg ?? t('agentAdmin.polishFailed'))
          return
        }
        if (accepted.beforeSize !== undefined) polishBeforeSize.value = accepted.beforeSize

        const final = await pollPolish(current.name, file, accepted.runId)
        if (!final) {
          MessagePlugin.error(t('agentAdmin.polishFailed'))
        } else if (final.running) {
          MessagePlugin.warning(t('agentAdmin.polishStillRunning'))
        } else if (final.error) {
          // 「已有一个任务正在执行」也走这里：如实告诉用户，而不是静默失败
          MessagePlugin.error(final.error)
        } else if (!final.ok) {
          MessagePlugin.error(t('agentAdmin.polishFailed'))
        } else if (polishBeforeSize.value !== null && final.size === polishBeforeSize.value) {
          // DSH 正常退出但不代表文件真的被改写（可能被文件策略拦下 / 只回答了没落盘）
          MessagePlugin.warning(t('agentAdmin.polishUnchanged'))
        } else {
          MessagePlugin.success(
            t('agentAdmin.polishSuccess', { duration: formatDuration(final.duration) })
          )
          // 磁盘上的文件已被改写，重新拉取当前文件内容与文件清单
          await loadDetail(current.name, true)
          await loadList()
        }
      } catch {
        MessagePlugin.error(t('agentAdmin.polishRetry'))
      } finally {
        stopPolishTimer()
        isPolishing.value = false
      }
    }
  })
}

/**
 * 轮询润色进度直到结束
 *
 * @returns 结束时的状态；超过上限仍未结束则返回最后一次状态（running 仍为 true）
 */
async function pollPolish(
  name: string,
  file: string,
  runId: string
): Promise<AssetPolishStatus | null> {
  const deadline = Date.now() + POLISH_POLL_MAX_MS
  let last: AssetPolishStatus | null = null

  while (Date.now() < deadline) {
    await delay(POLISH_POLL_INTERVAL_MS)
    if (!isPolishing.value) return last // 组件已卸载 / 用户已离开

    try {
      const res = await props.api.getPolishStatus({ name, file, runId })
      if (res?.code !== 2000 || !res.data) continue
      last = res.data as AssetPolishStatus
      if (!last.running) return last
    } catch {
      // 单次查询失败（网络抖动）不终止轮询，等下一次
    }
  }

  return last
}

/** 让出事件循环若干毫秒（轮询间隔） */
function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

/** 停掉「已等待秒数」计时器 */
function stopPolishTimer() {
  if (!polishTimer) return
  window.clearInterval(polishTimer)
  polishTimer = 0
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
  // 选中的就是目录：新建的东西直接建在它里面
  if (activeDir.value) return activeDir.value
  // 选中的是文件：取它的父目录
  const index = path.lastIndexOf('/')
  return index > 0 ? path.slice(0, index) : ''
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
 * Remove Node
 * 删除「当前选中的那一个节点」：选中文件删文件，选中目录删目录（递归）。
 * 没有选中任何节点时按钮已禁用，这里再兜一层，绝不退化成删除整个条目。
 */
function handleRemoveNode() {
  const node = selectedNode.value
  const current = detail.value
  if (!current || !node) return

  removeNodeForm.value = { path: node.path, isDir: node.isDir, ackDir: false }
  removeNodeVisible.value = true
}

/** 确认删除选中节点：成功后刷新详情与列表，并清空当前选中 */
async function handleConfirmRemoveNode() {
  const current = detail.value
  const form = removeNodeForm.value
  if (!current || !form.path || removeNodeSubmitting.value) return

  // 目录删除必须勾选确认框（按钮已禁用，这里再挡一次）
  if (form.isDir && !form.ackDir) return

  removeNodeSubmitting.value = true
  try {
    const res = await props.api.removeAssetNode({ name: current.name, path: form.path })
    if (res.code === 2000) {
      MessagePlugin.success(
        t(form.isDir ? 'agentAdmin.removeDirSuccess' : 'agentAdmin.removeFileSuccess', {
          path: form.path
        })
      )
      removeNodeVisible.value = false
      // 删掉的节点可能正在被查看 / 编辑，清空选中并退出编辑态
      activeFile.value = ''
      isEditing.value = false
      editContent.value = ''
      fileContent.value = ''
      await loadDetail(current.name)
      await loadList()
    } else {
      MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.removeNodeFailed'))
    }
  } catch {
    MessagePlugin.error(t('agentAdmin.removeNodeRetry'))
  } finally {
    removeNodeSubmitting.value = false
  }
}

/**
 * Remove Item
 * 删除整个条目：「更多」菜单里才会触发，弹重度提醒并必须勾选确认
 */
function openRemoveItem() {
  const current = detail.value
  if (!current) return

  removeItemForm.value = { name: current.name, ackItem: false }
  removeItemVisible.value = true
}

/** 确认删除整个条目：成功后清空右侧详情并刷新列表 */
async function handleConfirmRemoveItem() {
  const form = removeItemForm.value
  if (!form.name || !form.ackItem || removeItemSubmitting.value) return

  removeItemSubmitting.value = true
  try {
    const res = await props.api.removeAsset(form.name)
    if (res.code === 2000) {
      MessagePlugin.success(t('agentAdmin.removeItemSuccess', { name: form.name }))
      removeItemVisible.value = false
      activeName.value = ''
      activeFile.value = ''
      detail.value = null
      isEditing.value = false
      editContent.value = ''
      await Promise.all([loadList(true), loadOverview()])
    } else {
      MessagePlugin.error(res.message ?? res.msg ?? t('agentAdmin.removeItemFailed'))
    }
  } catch {
    MessagePlugin.error(t('agentAdmin.removeItemRetry'))
  } finally {
    removeItemSubmitting.value = false
  }
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

<template>
  <t-card class="container">
    <!-- 工具条：审计筛选条件 -->
    <template #title>
      <t-space align="center" break-line>
        <t-input
          v-model="searchForm.ep.keyword"
          class="system-ops-log__field system-ops-log__field--keyword"
          :placeholder="$t('systemOpsLog.keywordPlaceholder')"
          clearable
          @enter="handleSearch"
          @clear="handleSearch"
        />
        <t-input
          v-model="searchForm.ep.username"
          class="system-ops-log__field"
          :placeholder="$t('systemOpsLog.usernamePlaceholder')"
          clearable
          @enter="handleSearch"
          @clear="handleSearch"
        />
        <t-select
          v-model="searchForm.ep.action"
          class="system-ops-log__field system-ops-log__field--action"
          :options="actionOptions"
          :placeholder="$t('systemOpsLog.actionPlaceholder')"
          clearable
          @change="handleSearch"
        />
        <t-select
          v-model="searchForm.ep.success"
          class="system-ops-log__field system-ops-log__field--result"
          :options="resultOptions"
          :placeholder="$t('systemOpsLog.resultPlaceholder')"
          @change="handleSearch"
        />
        <t-button theme="success" :loading="listLoading" @click="handleSearch">
          {{ $t('common.search') }}
          <template #icon>
            <SearchIcon />
          </template>
        </t-button>
        <t-button variant="outline" :loading="listLoading" @click="getAuditData">
          {{ $t('systemOpsLog.refresh') }}
          <template #icon>
            <RefreshIcon />
          </template>
        </t-button>
      </t-space>
    </template>

    <!-- 附加工具：自动刷新 + 服务端原始日志入口 -->
    <template #actions>
      <t-space align="center" :size="12">
        <t-space align="center" :size="6">
          <span class="system-ops-log__switch-label">{{ $t('systemOpsLog.autoRefresh') }}</span>
          <t-switch v-model="autoRefresh" size="small" />
        </t-space>
        <t-button variant="outline" @click="handleOpenLogDrawer">
          {{ $t('systemOpsLog.serverLog') }}
        </t-button>
      </t-space>
    </template>

    <template #default>
      <div class="system-ops-log__body">
        <div ref="tableWrapRef" class="system-ops-log__table">
          <t-table
            size="small"
            :data="listData.data"
            :columns="tableColumns"
            :loading="listLoading"
            row-key="log_id"
            bordered
            hover
            resizable
            :maxHeight="tableMaxHeight"
            tableLayout="fixed"
          >
            <!-- 时间 -->
            <template #created_at="{ row }">
              {{ formatDateTime(row.created_at) }}
            </template>

            <!-- 操作人 -->
            <template #username="{ row }">
              <span>{{ row.username || $t('systemOpsLog.unknownUser') }}</span>
            </template>

            <!-- 操作：只展示操作名，不再拼接含参数的句子 -->
            <template #action="{ row }">
              <span class="system-ops-log__action-name">{{ getActionName(row) }}</span>
            </template>

            <!-- 参数摘要：统一压成短的 key=value 文本 -->
            <template #summary="{ row }">
              <span
                class="system-ops-log__summary"
                :class="{ 'system-ops-log__muted': !row.summary }"
              >
                {{ formatSummary(row.summary) || $t('systemOpsLog.emptySummary') }}
              </span>
            </template>

            <!-- 结果 -->
            <template #result="{ row }">
              <t-space align="center" :size="6">
                <t-tag :theme="row.success ? 'success' : 'danger'" variant="light" size="small">
                  {{ row.success ? $t('systemOpsLog.auditSuccess') : $t('systemOpsLog.auditFailed') }}
                </t-tag>
                <span class="system-ops-log__result-message">
                  {{ formatResultMessage(row.result_message) }}
                </span>
              </t-space>
            </template>

            <!-- 耗时 -->
            <template #duration="{ row }">
              {{ $t('systemOpsLog.durationUnit', { ms: row.duration ?? '-' }) }}
            </template>
          </t-table>
        </div>
      </div>
    </template>

    <template #footer>
      <t-pagination
        v-model="searchForm.paging.pageNumber"
        v-model:pageSize="searchForm.paging.pageSize"
        style="width: 100%;"
        :total="listData.total"
        :page-size-options="[10, 20, 50, 100]"
        show-jumper
        @change="handlePageChange"
      />
    </template>
  </t-card>

  <!-- 服务端原始日志抽屉 -->
  <t-drawer
    v-model:visible="logDrawerVisible"
    :header="$t('systemOpsLog.serverLog')"
    size="72%"
    :footer="false"
  >
    <div class="system-ops-log__drawer">
      <t-alert theme="info" :message="$t('systemOpsLog.serverLogTip')" />

      <div class="system-ops-log__drawer-toolbar">
        <t-select
          v-model="logForm.file"
          class="system-ops-log__field system-ops-log__field--file"
          :options="logFileOptions"
          :placeholder="$t('systemOpsLog.logFile')"
          @change="loadLog"
        />
        <t-select
          v-model="logForm.level"
          class="system-ops-log__field"
          :options="logLevelOptions"
          :placeholder="$t('systemOpsLog.logLevel')"
          @change="loadLog"
        />
        <t-select
          v-model="logForm.lines"
          class="system-ops-log__field"
          :options="logLineOptions"
          :placeholder="$t('systemOpsLog.logLines')"
          @change="loadLog"
        />
        <t-input
          v-model="logForm.keyword"
          class="system-ops-log__field system-ops-log__field--keyword"
          :placeholder="$t('systemOpsLog.logKeywordPlaceholder')"
          clearable
          @enter="loadLog"
          @clear="loadLog"
        />
        <t-button variant="outline" :loading="logLoading" @click="loadLog">
          {{ $t('systemOpsLog.refresh') }}
          <template #icon>
            <RefreshIcon />
          </template>
        </t-button>
        <t-button theme="danger" variant="outline" @click="handleClearLog">
          {{ $t('systemOpsLog.clearLog') }}
        </t-button>
      </div>

      <div class="system-ops-log__meta">
        <span>{{ $t('systemOpsLog.logTotal', { total: logResult.total }) }}</span>
        <span>{{ $t('systemOpsLog.logMatched', { matched: logResult.matched }) }}</span>
        <span>{{ $t('systemOpsLog.logShown', { shown: logResult.returned }) }}</span>
        <span v-if="logResult.truncated">
          {{ $t('systemOpsLog.logTruncated', { lines: logResult.returned }) }}
        </span>
        <span class="system-ops-log__meta-file">{{ logResult.file || '-' }}</span>
      </div>

      <t-loading :loading="logLoading">
        <pre class="system-ops-log__log">{{ logResult.content || $t('systemOpsLog.logEmpty') }}</pre>
      </t-loading>
    </div>
  </t-drawer>
</template>

<script lang="ts">
export default { name: 'SystemOpsLogPage' }
</script>

<script lang="ts" setup>
// 1. 第三方依赖
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next'
// 2. 工程内工具
import { useI18n } from 'vue-i18n'
import { formatSummaryText, truncateText } from '@/utils/common/formatSummary'
// 3. 接口
import * as api from './api'

const { t } = useI18n()

/** 自动刷新间隔（毫秒） */
const AUTO_REFRESH_INTERVAL = 5000

/** 结果说明展示长度上限 */
const RESULT_MESSAGE_MAX_LENGTH = 30

/** 表格最大高度兜底值：容器还没量出来时使用 */
const FALLBACK_TABLE_MAX_HEIGHT = 560
/** 表格最大高度可用下限，量到的值比它还小说明没量准，改用兜底值 */
const MIN_TABLE_MAX_HEIGHT = 240
/** 表格底部预留空间，避免贴住卡片内边距 */
const TABLE_MAX_HEIGHT_RESERVE = 8

// 页面打开时
onMounted(() => {
  getAuditData()
  loadActions()
  nextTick(updateTableMaxHeight)
  window.addEventListener('resize', updateTableMaxHeight)
})

// KeepAlive 切回本页时恢复自动刷新，并刷新一次审计列表
onActivated(() => {
  if (autoRefresh.value) startAutoRefresh()
  if (hasActivated) getAuditData()
  hasActivated = true
  nextTick(updateTableMaxHeight)
})

// 切走后停掉定时器，避免后台空跑
onDeactivated(() => {
  stopAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
  window.removeEventListener('resize', updateTableMaxHeight)
})

/**
 * Data Setting
 * 数据配置
 */
// 搜索表单：ep 为业务条件，paging 为分页
const searchForm: Ref<{
  ep: { keyword: string; username: string; action: string; success: string },
  paging: { pageNumber: number; pageSize: number },
  cdList: any[]
}> = ref({
  ep: {
    keyword: '',
    username: '',
    action: '',
    success: ''
  },
  paging: {
    pageNumber: 1,
    pageSize: 10
  },
  cdList: []
})

// 审计表格数据
const listData = ref({ data: [] as any[], total: 0 })
// 审计表格加载
const listLoading = ref(false)
// 自动刷新开关
const autoRefresh = ref(false)
// 表格外层容器：用于动态测量表格可用高度
const tableWrapRef = ref<HTMLElement | null>(null)
// 表格最大高度（动态计算，不用写死的 575）
const tableMaxHeight = ref(FALLBACK_TABLE_MAX_HEIGHT)

// 操作类型下拉选项
const actionNames = ref<string[]>([])
// 日志抽屉显隐
const logDrawerVisible = ref(false)
// 日志文件列表
const logFiles = ref<any[]>([])
// 日志读取结果
const logResult = ref<any>({ total: 0, matched: 0, returned: 0, content: '', file: '' })
// 日志读取加载
const logLoading = ref(false)
// 日志读取条件
const logForm = ref<{ file?: string; level?: string; lines: number | string; keyword: string }>({
  file: undefined,
  level: undefined,
  lines: 200,
  keyword: ''
})

/** 自动刷新定时器 */
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
/** 是否已经历过首次激活，用于区分 KeepAlive 的「切回」 */
let hasActivated = false

/**
 * Computed Setting
 * 计算配置
 */

/** 审计表格列：时间 / 操作人 / 操作 / 参数摘要 / 结果 / 耗时 / IP */
const tableColumns = computed<any[]>(() => [
  { colKey: 'created_at', title: t('systemOpsLog.colTime'), width: 160 },
  { colKey: 'username', title: t('systemOpsLog.colUser'), width: 120, ellipsis: true },
  { colKey: 'action', title: t('systemOpsLog.colAction'), width: 200, ellipsis: true },
  { colKey: 'summary', title: t('systemOpsLog.colSummary'), minWidth: 200, ellipsis: true },
  { colKey: 'result', title: t('systemOpsLog.colResult'), width: 200 },
  { colKey: 'duration', title: t('systemOpsLog.colDuration'), width: 100 },
  { colKey: 'ip', title: t('systemOpsLog.colIp'), width: 140, ellipsis: true }
])

/** 操作类型下拉：带「全部操作」 */
const actionOptions = computed(() => [
  { label: t('systemOpsLog.allActions'), value: '' },
  ...actionNames.value.map((name) => ({ label: name, value: name }))
])

/** 结果下拉：全部 / 成功 / 失败 */
const resultOptions = computed(() => [
  { label: t('systemOpsLog.allResult'), value: '' },
  { label: t('systemOpsLog.auditSuccess'), value: 'true' },
  { label: t('systemOpsLog.auditFailed'), value: 'false' }
])

/** 日志文件下拉：文件名后带大小 */
const logFileOptions = computed(() =>
  logFiles.value.map((item) => ({
    label: t('systemOpsLog.fileWithSize', { name: item.name, size: formatBytes(item.size) }),
    value: item.name
  }))
)

/** 日志级别下拉 */
const logLevelOptions = computed(() => [
  { label: t('systemOpsLog.allLevel'), value: '' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARN', value: 'WARN' },
  { label: 'ERROR', value: 'ERROR' },
  { label: 'DEBUG', value: 'DEBUG' }
])

/** 日志行数下拉 */
const logLineOptions = [
  { label: '100', value: 100 },
  { label: '200', value: 200 },
  { label: '500', value: 500 },
  { label: '1000', value: 1000 },
  { label: '2000', value: 2000 }
]

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

/** 操作名：优先用后端反查出的中文名，缺失时回退成「方法 + 地址」 */
function getActionName(row: any): string {
  if (row?.action_name) return row.action_name

  const method = String(row?.method || '').toUpperCase()
  const url = row?.url || ''
  if (!method && !url) return t('systemOpsLog.unknownAction')

  return t('systemOpsLog.fallbackAction', { method, url })
}

/** 参数摘要：把后端存的 JSON / 长摘要压成短的 key=value 文本 */
function formatSummary(summary?: string | null): string {
  return formatSummaryText(summary, (count) => t('systemOpsLog.arrayItems', { count }))
}

/** 结果说明：前端再截到 30 字，避免撑高行高 */
function formatResultMessage(message?: string | null): string {
  return truncateText(String(message ?? ''), RESULT_MESSAGE_MAX_LENGTH)
}

/**
 * Update Table Height
 * 动态计算表格最大高度：表格外层容器已被 flex 撑满内容区
 * （卡片头部工具条、卡片底部分页在布局里已经先行扣减），
 * 这里再留 8px 余量；量不到或量到的值过小时用兜底值。
 */
function updateTableMaxHeight() {
  const wrap = tableWrapRef.value
  if (!wrap) return

  const available = wrap.clientHeight - TABLE_MAX_HEIGHT_RESERVE
  tableMaxHeight.value = available >= MIN_TABLE_MAX_HEIGHT
    ? Math.floor(available)
    : FALLBACK_TABLE_MAX_HEIGHT
}

/** 组装查询参数：空条件不下发，避免后端把空串当成过滤值 */
function buildQuery() {
  const ep: Record<string, string> = {}
  Object.entries(searchForm.value.ep).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) ep[key] = value
  })

  return {
    ep,
    paging: searchForm.value.paging,
    cdList: searchForm.value.cdList
  }
}

/**
 * Get Audit List
 * 获取操作审计列表
 */
async function getAuditData() {
  listLoading.value = true
  try {
    const res = await api.getAuditList(buildQuery())
    if (res.code === 2000) {
      listData.value.data = res.data?.data || []
      listData.value.total = res.data?.total || 0
    } else {
      MessagePlugin.error(res.message ?? t('systemOpsLog.auditListFailed'))
    }
  } catch {
    // 网络异常已由请求拦截器统一提示
  } finally {
    listLoading.value = false
  }
}

/**
 * Get Action Names
 * 获取操作类型下拉选项
 */
async function loadActions() {
  try {
    const res = await api.getAuditActions()
    if (res.code === 2000) {
      actionNames.value = res.data?.names || []
    } else {
      MessagePlugin.error(res.message ?? t('systemOpsLog.actionsFailed'))
    }
  } catch {
    // 网络异常已由请求拦截器统一提示
  }
}

/**
 * Search
 * 搜索：回到第一页重新查询
 */
function handleSearch() {
  searchForm.value.paging.pageNumber = 1
  getAuditData()
}

/** 分页改变处理 */
function handlePageChange(info: any) {
  searchForm.value.paging.pageNumber = info.current
  searchForm.value.paging.pageSize = info.pageSize
  getAuditData()
}

/** 开启自动刷新：每 5 秒刷新审计列表，抽屉打开时同时刷新日志 */
function startAutoRefresh() {
  stopAutoRefresh()
  autoRefreshTimer = setInterval(() => {
    getAuditData()
    if (logDrawerVisible.value) loadLog()
  }, AUTO_REFRESH_INTERVAL)
}

/** 关闭自动刷新 */
function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

/** 自动刷新开关联动定时器 */
watch(autoRefresh, (enabled) => {
  if (enabled) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

/**
 * Open Log Drawer
 * 打开服务端原始日志抽屉
 */
async function handleOpenLogDrawer() {
  logDrawerVisible.value = true
  if (!logFiles.value.length) await loadLogFiles()
  await loadLog()
}

/**
 * Get Log Files
 * 获取服务端日志文件列表
 */
async function loadLogFiles() {
  try {
    const res = await api.getLogFiles()
    if (res.code !== 2000) return

    logFiles.value = res.data?.files || []
    if (!logForm.value.file && logFiles.value.length) {
      logForm.value.file = logFiles.value[0].name
    }
  } catch {
    // 网络异常已由请求拦截器统一提示
  }
}

/**
 * Read Log
 * 读取服务端原始日志内容
 */
async function loadLog() {
  logLoading.value = true
  try {
    const res = await api.readLog({
      file: logForm.value.file,
      lines: logForm.value.lines,
      level: logForm.value.level || undefined,
      keyword: logForm.value.keyword || undefined
    })
    if (res.code === 2000) logResult.value = res.data
  } catch {
    // 网络异常已由请求拦截器统一提示
  } finally {
    logLoading.value = false
  }
}

/**
 * Clear Log
 * 清空当前日志文件（二次确认）
 */
function handleClearLog() {
  const dialog = DialogPlugin.confirm({
    header: t('systemOpsLog.clearLog'),
    body: t('systemOpsLog.clearLogConfirm', { file: logResult.value.file || logForm.value.file }),
    theme: 'danger',
    confirmBtn: { content: t('common.confirm'), theme: 'danger' },
    onConfirm: async () => {
      dialog.update({ confirmBtn: { loading: true, content: t('common.deleting'), theme: 'danger' } })
      try {
        const res = await api.clearLog(logForm.value.file)
        if (res.code === 2000) {
          MessagePlugin.success(t('systemOpsLog.clearLogSuccess'))
          await loadLog()
        } else {
          MessagePlugin.error(res.message ?? t('systemOpsLog.clearLogFailed'))
        }
      } catch {
        // 网络异常已由请求拦截器统一提示
      } finally {
        dialog.hide()
      }
    }
  })
}
</script>

<style lang="scss" scoped>@import url("./index.scss");</style>

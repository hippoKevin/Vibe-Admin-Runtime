<template>
  <div class="system-ops">
    <t-tabs v-model="activeTab" theme="card">
      <!-- ==================== 关于系统 ==================== -->
      <t-tab-panel value="about" :label="$t('systemOps.aboutTab')">
        <div class="system-ops__panel">
          <div class="system-ops__toolbar">
            <t-button variant="outline" :loading="aboutLoading" @click="loadAbout">
              <template #icon><RefreshIcon /></template>
              {{ $t('systemOps.refresh') }}
            </t-button>
          </div>

          <t-loading :loading="aboutLoading">
            <t-card
              v-for="group in aboutGroups"
              :key="group.title"
              class="system-ops__card"
              :title="$t(`systemOps.${group.title}`)"
            >
              <t-descriptions :column="2" size="small" bordered>
                <t-descriptions-item
                  v-for="row in group.rows"
                  :key="row.label"
                  :label="$t(`systemOps.${row.label}`)"
                >
                  {{ row.value }}
                </t-descriptions-item>
              </t-descriptions>
            </t-card>
          </t-loading>
        </div>
      </t-tab-panel>

      <!-- ==================== 系统日志 ==================== -->
      <t-tab-panel value="log" :label="$t('systemOps.logTab')">
        <div class="system-ops__panel">
          <div class="system-ops__toolbar">
            <t-select
              v-model="logForm.file"
              class="system-ops__field system-ops__field--file"
              :options="logFileOptions"
              :placeholder="$t('systemOps.logFile')"
              @change="loadLog"
            />
            <t-select
              v-model="logForm.level"
              class="system-ops__field"
              :options="logLevelOptions"
              :placeholder="$t('systemOps.logLevel')"
              @change="loadLog"
            />
            <t-select
              v-model="logForm.lines"
              class="system-ops__field"
              :options="logLineOptions"
              @change="loadLog"
            />
            <t-input
              v-model="logForm.keyword"
              class="system-ops__field system-ops__field--keyword"
              :placeholder="$t('systemOps.logKeywordPlaceholder')"
              clearable
              @enter="loadLog"
              @clear="loadLog"
            />
            <t-button variant="outline" :loading="logLoading" @click="loadLog">
              <template #icon><RefreshIcon /></template>
              {{ $t('systemOps.refresh') }}
            </t-button>
            <t-button theme="danger" variant="outline" @click="handleClearLog">
              {{ $t('systemOps.clearLog') }}
            </t-button>
            <div class="system-ops__switch">
              <span>{{ $t('systemOps.autoRefresh') }}</span>
              <t-switch v-model="autoRefresh" size="small" />
            </div>
          </div>

          <div class="system-ops__meta">
            <span>{{ $t('systemOps.logTotal', { total: logResult.total }) }}</span>
            <span>{{ $t('systemOps.logMatched', { matched: logResult.matched }) }}</span>
            <span>{{ $t('systemOps.logShown', { shown: logResult.returned }) }}</span>
            <span v-if="logResult.truncated">
              {{ $t('systemOps.logTruncated', { lines: logResult.returned }) }}
            </span>
            <span class="system-ops__meta-dir">{{ logResult.file || '-' }}</span>
          </div>

          <t-loading :loading="logLoading">
            <pre class="system-ops__log">{{ logResult.content || $t('systemOps.logEmpty') }}</pre>
          </t-loading>
        </div>
      </t-tab-panel>

      <!-- ==================== 环境配置 ==================== -->
      <t-tab-panel value="env" :label="$t('systemOps.envTab')">
        <div class="system-ops__panel">
          <div class="system-ops__toolbar">
            <t-select
              v-model="envForm.file"
              class="system-ops__field system-ops__field--file"
              :options="envFileOptions"
              :placeholder="$t('systemOps.envFile')"
              @change="loadEnvDetail"
            />
            <t-tag v-if="envResult.activeFile === envForm.file" theme="success" variant="light">
              {{ $t('systemOps.activeTag') }}
            </t-tag>
            <t-button variant="outline" :loading="envLoading" @click="loadEnvDetail">
              <template #icon><RefreshIcon /></template>
              {{ $t('systemOps.refresh') }}
            </t-button>
            <t-button variant="outline" @click="handleAddEnvItem">
              {{ $t('systemOps.addItem') }}
            </t-button>
            <div class="system-ops__switch">
              <span>{{ $t('systemOps.showSecret') }}</span>
              <t-switch v-model="showSecret" size="small" />
            </div>
            <t-button theme="primary" :loading="envSaving" @click="handleSaveEnv">
              {{ $t('systemOps.saveAndRestart') }}
            </t-button>
          </div>

          <t-alert class="system-ops__tip" theme="info" :message="$t('systemOps.secretTip')" />
          <div class="system-ops__hint">{{ $t('systemOps.backupTip') }}</div>

          <t-loading :loading="envLoading">
            <div class="system-ops__env">
              <div class="system-ops__env-head">
                <span class="system-ops__env-key">{{ $t('systemOps.key') }}</span>
                <span class="system-ops__env-value">{{ $t('systemOps.value') }}</span>
                <span class="system-ops__env-action"></span>
              </div>

              <div
                v-for="(item, index) in envItems"
                :key="item.uid"
                class="system-ops__env-row"
              >
                <div class="system-ops__env-key">
                  <t-input
                    v-if="item.isNew"
                    v-model="item.key"
                    :placeholder="$t('systemOps.newKeyPlaceholder')"
                  />
                  <span v-else class="system-ops__env-name">
                    {{ item.key }}
                    <t-tag v-if="item.secret" theme="warning" variant="light" size="small">
                      {{ $t('systemOps.secretTag') }}
                    </t-tag>
                  </span>
                </div>

                <div class="system-ops__env-value">
                  <t-input
                    v-model="item.value"
                    :type="item.secret && !showSecret ? 'password' : 'text'"
                    :placeholder="item.secret && item.hasValue
                      ? $t('systemOps.secretPlaceholder')
                      : $t('systemOps.valuePlaceholder')"
                  />
                </div>

                <div class="system-ops__env-action">
                  <t-button theme="danger" variant="text" @click="handleDeleteEnvItem(index)">
                    {{ $t('common.delete') }}
                  </t-button>
                </div>
              </div>

              <div v-if="!envItems.length" class="system-ops__empty">
                {{ $t('systemOps.envEmpty') }}
              </div>
            </div>
          </t-loading>
        </div>
      </t-tab-panel>
    </t-tabs>
  </div>
</template>

<script lang="ts">
export default { name: 'SystemOpsPage' }
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import axios from 'axios'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { RefreshIcon } from 'tdesign-icons-vue-next'
import { useI18n } from 'vue-i18n'
import * as api from './api'

const { t } = useI18n()

const activeTab = ref<'about' | 'log' | 'env'>('about')

/** 日志自动刷新定时器 */
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

// ==================================================================
// 公共格式化
// ==================================================================

/** 字节格式化：1536 -> 1.50 KB */
function formatBytes(bytes?: number | null): string {
  const value = Number(bytes)
  if (!Number.isFinite(value)) return '-'
  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB', 'TB', 'PB']
  let size = value
  let index = -1
  do {
    size = size / 1024
    index += 1
  } while (size >= 1024 && index < units.length - 1)

  return `${size.toFixed(2)} ${units[index]}`
}

/** 秒格式化：90061 -> 1天 1小时 1分 1秒 */
function formatDuration(seconds?: number): string {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const parts: string[] = []

  const day = Math.floor(total / 86400)
  const hour = Math.floor((total % 86400) / 3600)
  const minute = Math.floor((total % 3600) / 60)
  const second = total % 60

  if (day) parts.push(`${day}${t('systemOps.day')}`)
  if (hour) parts.push(`${hour}${t('systemOps.hour')}`)
  if (minute) parts.push(`${minute}${t('systemOps.minute')}`)
  if (!parts.length || second) parts.push(`${second}${t('systemOps.second')}`)

  return parts.join(' ')
}

/** 时间格式化：ISO -> YYYY-MM-DD HH:mm:ss */
function formatTime(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 延时 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ==================================================================
// 关于系统
// ==================================================================

const aboutLoading = ref(false)
const about = ref<any>(null)

/** 按分组拼装展示行，label 为 i18n key，value 为展示值 */
const aboutGroups = computed(() => {
  const data = about.value
  if (!data) return []

  const groups: { title: string; rows: { label: string; value: string }[] }[] = [
    {
      title: 'basicInfo',
      rows: [
        { label: 'appName', value: data.app.name || '-' },
        { label: 'appVersion', value: data.app.version || '-' },
        { label: 'nodeEnv', value: data.app.nodeEnv || '-' },
        { label: 'pid', value: String(data.app.pid ?? '-') },
        { label: 'startedAt', value: formatTime(data.app.startedAt) },
        { label: 'uptime', value: formatDuration(data.app.uptime) },
        { label: 'serverTime', value: formatTime(data.app.serverTime) },
        { label: 'timezone', value: data.app.timezone || '-' },
      ],
    },
    {
      title: 'runtimeInfo',
      rows: [
        { label: 'nodeVersion', value: data.runtime.node || '-' },
        { label: 'platform', value: data.runtime.platform || '-' },
        { label: 'arch', value: data.runtime.arch || '-' },
        { label: 'hostname', value: data.runtime.hostname || '-' },
        { label: 'cwd', value: data.runtime.cwd || '-' },
        { label: 'cpuModel', value: data.cpu.model || '-' },
        { label: 'cpuCores', value: String(data.cpu.cores ?? '-') },
        { label: 'loadAvg', value: (data.cpu.loadavg || []).join(' / ') || '-' },
      ],
    },
    {
      title: 'resourceInfo',
      rows: [
        { label: 'memTotal', value: formatBytes(data.memory.total) },
        {
          label: 'memUsed',
          value: `${formatBytes(data.memory.used)}（${data.memory.usagePercent}%）`,
        },
        { label: 'memFree', value: formatBytes(data.memory.free) },
        { label: 'processMem', value: formatBytes(data.memory.processRss) },
        { label: 'heapUsed', value: formatBytes(data.memory.processHeapUsed) },
        {
          label: 'diskUsage',
          value: data.disk
            ? `${data.disk.usagePercent}%（${formatBytes(data.disk.used)} / ${formatBytes(data.disk.total)}）`
            : '-',
        },
      ],
    },
    {
      title: 'databaseInfo',
      rows: [
        {
          label: 'dbStatus',
          value: data.database.connected
            ? t('systemOps.dbConnected')
            : t('systemOps.dbDisconnected'),
        },
        { label: 'dbType', value: data.database.type || '-' },
        { label: 'dbHost', value: data.database.host || '-' },
        { label: 'dbPort', value: String(data.database.port ?? '-') },
        { label: 'dbName', value: data.database.database || '-' },
        { label: 'dbUser', value: data.database.username || '-' },
        { label: 'dbVersion', value: data.database.version || '-' },
        { label: 'dbLatency', value: `${data.database.latency ?? '-'} ms` },
      ],
    },
    {
      title: 'configInfo',
      rows: [
        { label: 'activeEnvFile', value: data.env.activeFile || '-' },
        {
          label: 'envFiles',
          value: (data.env.files || []).map((item: any) => item.name).join(' , ') || '-',
        },
        { label: 'logDir', value: data.logs.dir || '-' },
        { label: 'logFileCount', value: String(data.logs.fileCount ?? '-') },
        { label: 'logSize', value: formatBytes(data.logs.totalSize) },
      ],
    },
  ]

  // 数据库连接失败时把错误原因也带出来，方便排查
  if (data.database?.error) {
    groups[3].rows.push({ label: 'dbError', value: String(data.database.error) })
  }

  return groups
})

/** 加载关于系统 */
async function loadAbout() {
  aboutLoading.value = true
  try {
    const res = await api.getSystemAbout()
    if (res.code === 2000) about.value = res.data
  } finally {
    aboutLoading.value = false
  }
}

// ==================================================================
// 系统日志
// ==================================================================

const logLoading = ref(false)
const logFiles = ref<any[]>([])
const logResult = ref<any>({ total: 0, matched: 0, returned: 0, content: '', file: '' })
const autoRefresh = ref(false)

const logForm = ref<{ file?: string; level?: string; lines: number | string; keyword: string }>({
  file: undefined,
  level: undefined,
  lines: 200,
  keyword: '',
})

const logFileOptions = computed(() =>
  logFiles.value.map((item) => ({
    label: `${item.name}（${formatBytes(item.size)}）`,
    value: item.name,
  })),
)

const logLevelOptions = computed(() => [
  { label: t('systemOps.allLevel'), value: '' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARN', value: 'WARN' },
  { label: 'ERROR', value: 'ERROR' },
  { label: 'DEBUG', value: 'DEBUG' },
])

const logLineOptions = [
  { label: '100', value: 100 },
  { label: '200', value: 200 },
  { label: '500', value: 500 },
  { label: '1000', value: 1000 },
  { label: '2000', value: 2000 },
]

/** 日志文件列表 */
async function loadLogFiles() {
  const res = await api.getLogFiles()
  if (res.code !== 2000) return

  logFiles.value = res.data.files || []
  if (!logForm.value.file && logFiles.value.length) {
    logForm.value.file = logFiles.value[0].name
  }
}

/** 读取日志内容 */
async function loadLog() {
  logLoading.value = true
  try {
    const res = await api.readLog({
      file: logForm.value.file,
      lines: logForm.value.lines,
      level: logForm.value.level || undefined,
      keyword: logForm.value.keyword || undefined,
    })
    if (res.code === 2000) logResult.value = res.data
  } finally {
    logLoading.value = false
  }
}

/** 清空当前日志 */
function handleClearLog() {
  const dialog = DialogPlugin.confirm({
    header: t('systemOps.clearLog'),
    body: t('systemOps.clearLogConfirm', { file: logResult.value.file || logForm.value.file }),
    theme: 'danger',
    confirmBtn: { content: t('common.confirm'), theme: 'danger', loading: false },
    onConfirm: async () => {
      const res = await api.clearLog(logForm.value.file)
      if (res.code === 2000) {
        MessagePlugin.success(t('systemOps.clearLogSuccess'))
        await loadLog()
      }
      dialog.hide()
    },
  })
}

/** 自动刷新：打开后每 5 秒拉取一次日志 */
watch(autoRefresh, (enabled) => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
  if (enabled) {
    autoRefreshTimer = setInterval(() => loadLog(), 5000)
  }
})

// ==================================================================
// 环境配置
// ==================================================================

interface EnvRow {
  /** 行唯一标识，用于 v-for key */
  uid: number
  key: string
  value: string
  /** 敏感项：不回显内容，留空表示不修改 */
  secret: boolean
  /** 敏感项原本是否有值 */
  hasValue: boolean
  /** 是否为新增行（只有新增行允许改名称） */
  isNew: boolean
}

const envLoading = ref(false)
const envSaving = ref(false)
const envResult = ref<any>({ file: '', activeFile: '', files: [] })
const envItems = ref<EnvRow[]>([])
const showSecret = ref(false)
const envForm = ref<{ file?: string }>({ file: undefined })

/** 待删除的配置项名称 */
let deletedKeys: string[] = []
/** 新增行的自增标识 */
let rowUid = 0

const envFileOptions = computed(() =>
  envResult.value.files?.map((item: any) => ({
    label: item.active ? `${item.name}（${t('systemOps.activeTag')}）` : item.name,
    value: item.name,
  })) || [],
)

/** 加载环境变量详情 */
async function loadEnvDetail() {
  envLoading.value = true
  try {
    const res = await api.getEnvDetail(envForm.value.file)
    if (res.code !== 2000) return

    envResult.value = res.data
    envForm.value.file = res.data.file
    deletedKeys = []
    envItems.value = (res.data.items || []).map((item: any) => ({
      uid: (rowUid += 1),
      key: item.key,
      value: item.value ?? '',
      secret: !!item.secret,
      hasValue: !!item.hasValue,
      isNew: false,
    }))
  } finally {
    envLoading.value = false
  }
}

/** 新增一行（名称可编辑） */
function handleAddEnvItem() {
  envItems.value.push({
    uid: (rowUid += 1),
    key: '',
    value: '',
    secret: false,
    hasValue: false,
    isNew: true,
  })
}

/** 删除一行：新增行直接移除，已有行记入待删除列表 */
function handleDeleteEnvItem(index: number) {
  const item = envItems.value[index]
  if (!item) return

  if (item.isNew) {
    envItems.value.splice(index, 1)
    return
  }

  const dialog = DialogPlugin.confirm({
    header: t('systemOps.deleteTitle'),
    body: t('systemOps.deleteConfirm', { key: item.key }),
    theme: 'danger',
    confirmBtn: { content: t('common.confirm'), theme: 'danger', loading: false },
    onConfirm: () => {
      deletedKeys.push(item.key)
      envItems.value.splice(index, 1)
      dialog.hide()
    },
  })
}

/** 校验并整理提交数据 */
function collectEnvItems(): { key: string; value: string }[] | null {
  const items: { key: string; value: string }[] = []
  const keys = new Set<string>()

  for (const item of envItems.value) {
    const key = String(item.key || '').trim()
    if (!key) {
      MessagePlugin.error(t('systemOps.keyRequired'))
      return null
    }
    if (keys.has(key)) {
      MessagePlugin.error(t('systemOps.keyDuplicate', { key }))
      return null
    }
    keys.add(key)
    items.push({ key, value: item.value ?? '' })
  }

  return items
}

/** 保存并重启 */
function handleSaveEnv() {
  const items = collectEnvItems()
  if (!items) return

  const dialog = DialogPlugin.confirm({
    header: t('systemOps.restartConfirmTitle'),
    body: t('systemOps.restartConfirmBody'),
    theme: 'warning',
    confirmBtn: { content: t('systemOps.saveAndRestart'), theme: 'primary', loading: false },
    onConfirm: async () => {
      dialog.hide()
      await submitEnv(items)
    },
  })
}

/** 提交保存请求，并按重启结果决定是否轮询等待服务恢复 */
async function submitEnv(items: { key: string; value: string }[]) {
  envSaving.value = true
  try {
    const res = await api.saveEnv({
      file: envForm.value.file as string,
      items,
      deletedKeys,
      restart: true,
    })
    if (res.code !== 2000) return

    if (!res.data.changed) {
      MessagePlugin.info(t('systemOps.noChange'))
      return
    }

    MessagePlugin.success(t('systemOps.saveSuccess'))

    const restart = res.data.restart || {}
    deletedKeys = []

    // 不重启时刷新页面数据；需要重启时服务马上会重启，直接进入等待流程
    if (!restart.triggered) {
      await loadEnvDetail()
      MessagePlugin.warning(restart.message || t('systemOps.restartManual'))
      return
    }

    await waitForRestart()
  } finally {
    envSaving.value = false
  }
}

/**
 * 等待服务重启完成
 *
 * 这里直接用 axios 请求 /proxy 下的探测接口，不走项目封装的 request：
 * 轮询期间服务本来就不可用，封装层会弹出大量错误提示。
 * 探测接口是公开的，不需要 token。
 */
async function waitForRestart() {
  const loading = MessagePlugin.loading({ content: t('systemOps.restarting'), duration: 0 })

  // 先等重启延迟（后端 1s）与服务停止，再开始探测
  await sleep(2000)

  const maxAttempts = 30
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await axios.get('/proxy/hippoadmin/system-ops/ping', { timeout: 3000 })
      if (res.data?.code === 2000) {
        loading.close?.()
        MessagePlugin.success(t('systemOps.restartDone'))
        setTimeout(() => window.location.reload(), 800)
        return
      }
    } catch {
      // 服务还没起来，继续等待下一次探测
    }
    await sleep(1500)
  }

  loading.close?.()
  MessagePlugin.warning(t('systemOps.restartTimeout'))
}

// ==================================================================
// 生命周期
// ==================================================================

onMounted(async () => {
  await loadAbout()
  await loadLogFiles()
  await loadLog()
  await loadEnvDetail()
})

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
})
</script>

<style scoped lang="scss">
.system-ops {
  padding: 4px;

  .system-ops__panel {
    padding-top: 12px;
  }

  .system-ops__toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .system-ops__field {
    width: 130px;

    &--file {
      width: 240px;
    }

    &--keyword {
      width: 200px;
    }
  }

  .system-ops__switch {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    font-size: calc(13px * var(--app-font-scale, 1));
    color: var(--td-text-color-secondary);
  }

  .system-ops__card {
    margin-bottom: 12px;
  }

  .system-ops__tip {
    margin-bottom: 8px;
  }

  .system-ops__hint {
    margin-bottom: 12px;
    font-size: calc(12px * var(--app-font-scale, 1));
    color: var(--td-text-color-placeholder);
  }

  .system-ops__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 8px;
    font-size: calc(12px * var(--app-font-scale, 1));
    color: var(--td-text-color-secondary);

    &-dir {
      margin-left: auto;
      color: var(--td-text-color-placeholder);
    }
  }

  .system-ops__log {
    height: calc(100vh - 330px);
    min-height: 240px;
    margin: 0;
    padding: 12px;
    overflow: auto;
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-default);
    background: var(--td-bg-color-container);
    color: var(--td-text-color-primary);
    font-family: Consolas, Monaco, 'Courier New', monospace;
    font-size: calc(12px * var(--app-font-scale, 1));
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .system-ops__env {
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-default);
    overflow: hidden;
  }

  .system-ops__env-head,
  .system-ops__env-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
  }

  .system-ops__env-head {
    background: var(--td-bg-color-secondarycontainer);
    font-size: calc(13px * var(--app-font-scale, 1));
    color: var(--td-text-color-secondary);
  }

  .system-ops__env-row {
    border-top: 1px solid var(--td-component-stroke);

    &:hover {
      background: var(--td-bg-color-container-hover);
    }
  }

  .system-ops__env-key {
    width: 260px;
    flex-shrink: 0;
  }

  .system-ops__env-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: calc(13px * var(--app-font-scale, 1));
    color: var(--td-text-color-primary);
    word-break: break-all;
  }

  .system-ops__env-value {
    flex: 1;
    min-width: 0;
  }

  .system-ops__env-action {
    width: 64px;
    flex-shrink: 0;
    text-align: right;
  }

  .system-ops__empty {
    padding: 24px;
    text-align: center;
    font-size: calc(13px * var(--app-font-scale, 1));
    color: var(--td-text-color-placeholder);
  }
}
</style>

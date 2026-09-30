<template>
  <t-card class="container">
    <!-- 工具条：刷新 -->
    <template #title>
      <t-space align="center">
        <t-button variant="outline" :loading="aboutLoading || metricsLoading" @click="handleRefresh">
          {{ $t('systemOpsAbout.refresh') }}
          <template #icon>
            <RefreshIcon />
          </template>
        </t-button>
      </t-space>
    </template>

    <!-- 附加工具：自动刷新 -->
    <template #actions>
      <t-space align="center" :size="6">
        <span class="system-ops-about__switch-label">{{ $t('systemOpsAbout.autoRefresh') }}</span>
        <t-switch v-model="autoRefresh" size="small" />
      </t-space>
    </template>

    <template #default>
      <div class="system-ops-about">
        <!-- 指标卡 -->
        <div class="system-ops-about__metrics">
          <t-card
            v-for="card in metricCards"
            :key="card.key"
            class="system-ops-about__metric"
            :bordered="true"
          >
            <div class="system-ops-about__metric-name">{{ card.name }}</div>
            <div class="system-ops-about__metric-value">{{ card.value }}</div>
            <div class="system-ops-about__metric-extra">
              <t-tag v-if="card.tag" :theme="card.tagTheme" variant="light" size="small">
                {{ card.tag }}
              </t-tag>
              <span v-if="card.tip" class="system-ops-about__metric-tip">{{ card.tip }}</span>
            </div>
          </t-card>
        </div>

        <!-- 趋势图 -->
        <t-card class="system-ops-about__card" :title="$t('systemOpsAbout.trendTitle')">
          <template #default>
            <div class="system-ops-about__chart-tip">{{ trendTip }}</div>
            <v-chart class="system-ops-about__chart" :option="trendOption" autoresize />
          </template>
        </t-card>

        <!-- 分布图 -->
        <div class="system-ops-about__distributions">
          <t-card
            class="system-ops-about__card system-ops-about__card--half"
            :title="$t('systemOpsAbout.diskChartTitle')"
          >
            <template #default>
              <v-chart
                v-if="diskOption"
                class="system-ops-about__chart system-ops-about__chart--small"
                :option="diskOption"
                autoresize
              />
              <div v-else class="system-ops-about__empty">
                {{ $t('systemOpsAbout.diskUnavailable') }}
              </div>
            </template>
          </t-card>

          <t-card
            class="system-ops-about__card system-ops-about__card--half"
            :title="$t('systemOpsAbout.memChartTitle')"
          >
            <template #default>
              <v-chart
                v-if="memoryOption"
                class="system-ops-about__chart system-ops-about__chart--small"
                :option="memoryOption"
                autoresize
              />
              <div v-else class="system-ops-about__empty">
                {{ $t('systemOpsAbout.memUnavailable') }}
              </div>
            </template>
          </t-card>
        </div>

        <!-- 明细分组 -->
        <t-card
          v-for="group in detailGroups"
          :key="group.title"
          class="system-ops-about__card"
          :title="$t(`systemOpsAbout.${group.title}`)"
        >
          <template #default>
            <t-descriptions :column="2" size="small" bordered>
              <t-descriptions-item
                v-for="row in group.rows"
                :key="row.label"
                :label="$t(`systemOpsAbout.${row.label}`)"
              >
                {{ row.value }}
              </t-descriptions-item>
            </t-descriptions>
          </template>
        </t-card>
      </div>
    </template>

    <template #footer>
      <div class="system-ops-about__footer">
        <span>{{ $t('systemOpsAbout.lastUpdated', { time: lastUpdatedText }) }}</span>
        <span class="system-ops-about__footer-time">
          {{ $t('systemOpsAbout.serverTimeTip', { time: serverTimeText }) }}
        </span>
      </div>
    </template>
  </t-card>
</template>

<script lang="ts">
export default { name: 'SystemOpsAboutPage' }
</script>

<script lang="ts" setup>
// 1. 第三方依赖
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { RefreshIcon } from 'tdesign-icons-vue-next'
// 2. 工程内工具
import { useI18n } from 'vue-i18n'
// 3. 接口
import * as api from './api'

const { t } = useI18n()

/** 自动刷新间隔（毫秒），与后端 metrics 的采样间隔保持一致 */
const AUTO_REFRESH_INTERVAL = 5000

// 页面打开时
onMounted(() => {
  handleRefresh()
})

// KeepAlive 切回本页时恢复自动刷新，并刷新一次数据
onActivated(() => {
  if (autoRefresh.value) startAutoRefresh()
  if (hasActivated) handleRefresh()
  hasActivated = true
})

// 切走后停掉定时器，避免后台空跑
onDeactivated(() => {
  stopAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

/**
 * Data Setting
 * 数据配置
 */
// 服务端运行信息加载
const aboutLoading = ref(false)
// 监控采样数据加载
const metricsLoading = ref(false)
// 服务端运行信息
const about = ref<any>(null)
// 监控采样数据（含趋势与当前值）
const metrics = ref<any>(null)
// 自动刷新开关
const autoRefresh = ref(false)
// 最近一次数据刷新时间
const lastUpdatedAt = ref<Date | null>(null)

/** 自动刷新定时器 */
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
/** 是否已经历过首次激活，用于区分 KeepAlive 的「切回」 */
let hasActivated = false

/**
 * Computed Setting
 * 计算配置
 */

/** 趋势采样点 */
const samples = computed<any[]>(() => metrics.value?.samples || [])

/** 趋势图辅助说明：采样点数量与采样间隔 */
const trendTip = computed(() => {
  const interval = Number(metrics.value?.interval || AUTO_REFRESH_INTERVAL) / 1000
  return t('systemOpsAbout.trendTip', {
    points: metrics.value?.points ?? samples.value.length,
    interval,
  })
})

/** 顶部指标卡 */
const metricCards = computed(() => {
  const aboutData = about.value || {}
  const memory = aboutData.memory || {}
  const current = metrics.value?.current || {}
  const disk = current.disk || aboutData.disk || null
  const db = aboutData.database || null
  const cores = metrics.value?.cpuCores ?? aboutData.cpu?.cores

  const cpuValue = current.cpuPercent ?? aboutData.cpu?.usagePercent
  const memValue = current.memUsedPercent ?? memory.usagePercent
  const uptimeValue = current.uptime ?? aboutData.app?.uptime

  const cards: {
    key: string
    name: string
    value: string
    tip: string
    tag?: string
    tagTheme?: 'success' | 'danger'
  }[] = [
    {
      key: 'cpu',
      name: t('systemOpsAbout.cpuUsage'),
      value: formatPercent(cpuValue),
      tip: cores ? t('systemOpsAbout.cpuCoresTip', { cores }) : '',
    },
    {
      key: 'memory',
      name: t('systemOpsAbout.memUsage'),
      value: formatPercent(memValue),
      tip: t('systemOpsAbout.memDetail', {
        used: formatBytes(memory.used),
        total: formatBytes(memory.total),
      }),
    },
    {
      key: 'disk',
      name: t('systemOpsAbout.diskUsage'),
      value: formatPercent(disk?.usagePercent),
      tip: t('systemOpsAbout.diskDetail', {
        used: formatBytes(disk?.used),
        total: formatBytes(disk?.total),
      }),
    },
    {
      key: 'uptime',
      name: t('systemOpsAbout.uptime'),
      value: formatDuration(uptimeValue),
      tip: t('systemOpsAbout.uptimeTip', { time: formatDateTime(aboutData.app?.startedAt) }),
    },
    {
      key: 'database',
      name: t('systemOpsAbout.dbLatency'),
      value: db?.latency === undefined || db?.latency === null
        ? '-'
        : t('systemOpsAbout.latencyUnit', { ms: db.latency }),
      tip: '',
      tag: db ? (db.connected ? t('systemOpsAbout.dbConnected') : t('systemOpsAbout.dbDisconnected')) : '',
      tagTheme: db?.connected ? 'success' : 'danger',
    },
  ]

  return cards
})

/** 资源趋势折线图：CPU% 与内存% */
const trendOption = computed(() => {
  const list = samples.value
  return {
    tooltip: { trigger: 'axis' },
    legend: {
      data: [t('systemOpsAbout.cpuSeries'), t('systemOpsAbout.memSeries')],
      top: 0,
    },
    grid: { left: 8, right: 16, top: 36, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: list.map((item) => formatClock(item.time)),
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { formatter: '{value}%' },
    },
    series: [
      {
        name: t('systemOpsAbout.cpuSeries'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.12 },
        itemStyle: { color: getCssVar('--td-brand-color', '#0052d9') },
        data: list.map((item) => roundNumber(item.cpuPercent)),
      },
      {
        name: t('systemOpsAbout.memSeries'),
        type: 'line',
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.12 },
        itemStyle: { color: getCssVar('--td-warning-color', '#ed7b2f') },
        data: list.map((item) => roundNumber(item.memUsedPercent)),
      },
    ],
  }
})

/** 磁盘占用饼图（已用 / 剩余） */
const diskOption = computed(() => {
  const disk = metrics.value?.current?.disk || about.value?.disk
  if (!disk || !Number.isFinite(Number(disk.total))) return null

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => `${params.name}: ${formatBytes(params.value)} (${params.percent}%)`,
    },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '44%'],
        label: { show: false },
        data: [
          { name: t('systemOpsAbout.used'), value: Number(disk.used) || 0 },
          { name: t('systemOpsAbout.free'), value: Number(disk.free) || 0 },
        ],
      },
    ],
  }
})

/** 内存占用条形图（已用 / 剩余） */
const memoryOption = computed(() => {
  const memory = about.value?.memory
  if (!memory || !Number.isFinite(Number(memory.total))) return null

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const item = Array.isArray(params) ? params[0] : params
        return `${item.name}: ${formatBytes(item.value)}`
      },
    },
    legend: { show: false },
    grid: { left: 8, right: 32, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (value: number) => formatBytes(value) },
    },
    yAxis: {
      type: 'category',
      data: [t('systemOpsAbout.used'), t('systemOpsAbout.free')],
    },
    series: [
      {
        type: 'bar',
        barWidth: 22,
        itemStyle: { color: getCssVar('--td-brand-color', '#0052d9') },
        data: [Number(memory.used) || 0, Number(memory.free) || 0],
      },
    ],
  }
})

/** 底部明细分组，label 为 i18n key，value 为展示值 */
const detailGroups = computed(() => {
  const data = about.value
  if (!data) return []

  const app = data.app || {}
  const runtime = data.runtime || {}
  const cpu = data.cpu || {}
  const memory = data.memory || {}
  const disk = data.disk
  const db = data.database || {}
  const logs = data.logs || {}
  const env = data.env || {}

  return [
    {
      title: 'basicInfo',
      rows: [
        { label: 'appName', value: app.name || '-' },
        { label: 'appVersion', value: app.version || '-' },
        { label: 'nodeEnv', value: app.nodeEnv || '-' },
        { label: 'pid', value: String(app.pid ?? '-') },
        { label: 'startedAt', value: formatDateTime(app.startedAt) },
        { label: 'uptime', value: formatDuration(app.uptime) },
        { label: 'serverTime', value: formatDateTime(app.serverTime) },
        { label: 'timezone', value: app.timezone || '-' },
        { label: 'appDescription', value: app.description || '-' },
      ],
    },
    {
      title: 'runtimeInfo',
      rows: [
        { label: 'nodeVersion', value: runtime.node || '-' },
        { label: 'platform', value: runtime.platform || '-' },
        { label: 'arch', value: runtime.arch || '-' },
        { label: 'hostname', value: runtime.hostname || '-' },
        { label: 'cwd', value: runtime.cwd || '-' },
        { label: 'cpuModel', value: cpu.model || '-' },
        { label: 'cpuCores', value: String(cpu.cores ?? '-') },
        { label: 'loadAvg', value: (cpu.loadavg || []).map((item: number) => roundNumber(item)).join(' / ') || '-' },
      ],
    },
    {
      title: 'resourceInfo',
      rows: [
        { label: 'memTotal', value: formatBytes(memory.total) },
        {
          label: 'memUsed',
          value: t('systemOpsAbout.valueWithPercent', {
            value: formatBytes(memory.used),
            percent: formatPercentNumber(memory.usagePercent),
          }),
        },
        { label: 'memFree', value: formatBytes(memory.free) },
        { label: 'processMem', value: formatBytes(memory.processRss) },
        { label: 'heapUsed', value: formatBytes(memory.processHeapUsed) },
        { label: 'heapTotal', value: formatBytes(memory.processHeapTotal) },
        {
          label: 'diskUsage',
          value: disk
            ? t('systemOpsAbout.valueWithPercent', {
                value: `${formatBytes(disk.used)} / ${formatBytes(disk.total)}`,
                percent: formatPercentNumber(disk.usagePercent),
              })
            : '-',
        },
      ],
    },
    {
      title: 'databaseInfo',
      rows: [
        {
          label: 'dbStatus',
          value: db.connected
            ? t('systemOpsAbout.dbConnected')
            : t('systemOpsAbout.dbDisconnected'),
        },
        { label: 'dbType', value: db.type || '-' },
        { label: 'dbHost', value: db.host || '-' },
        { label: 'dbPort', value: String(db.port ?? '-') },
        { label: 'dbName', value: db.database || '-' },
        { label: 'dbUser', value: db.username || '-' },
        { label: 'dbVersion', value: db.version || '-' },
        { label: 'dbLatencyLabel', value: t('systemOpsAbout.latencyUnit', { ms: db.latency ?? '-' }) },
        // 连接失败时把错误原因也带出来，方便排查
        ...(db.error ? [{ label: 'dbError', value: String(db.error) }] : []),
      ],
    },
    {
      title: 'configInfo',
      rows: [
        { label: 'activeEnvFile', value: env.activeFile || '-' },
        {
          label: 'envFiles',
          value: (env.files || []).map((item: any) => item.name).join(' , ') || '-',
        },
        { label: 'logDir', value: logs.dir || '-' },
        { label: 'logFileCount', value: String(logs.fileCount ?? '-') },
        { label: 'logSize', value: formatBytes(logs.totalSize) },
      ],
    },
  ]
})

/** 底部左侧：最近刷新时间 */
const lastUpdatedText = computed(() => formatDateTime(lastUpdatedAt.value))

/** 底部右侧：服务器时间 */
const serverTimeText = computed(() => formatDateTime(about.value?.app?.serverTime))

/**
 * Method Setting
 * 方法配置
 */

/** 读取主题 CSS 变量，供 ECharts 配色使用 */
function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** 转数字，非法值返回 null */
function toNumber(value?: number | string | null): number | null {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

/** 保留一位小数 */
function roundNumber(value?: number | string | null): number {
  const num = toNumber(value)
  return num === null ? 0 : Number(num.toFixed(1))
}

/** 百分比数值文本：38.2 -> 38.2 */
function formatPercentNumber(value?: number | null): string {
  const num = toNumber(value)
  return num === null ? '-' : num.toFixed(1)
}

/** 百分比展示：38.2 -> 38.2% */
function formatPercent(value?: number | null): string {
  const num = toNumber(value)
  if (num === null) return '-'
  return t('systemOpsAbout.percentUnit', { value: num.toFixed(1) })
}

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

/** 时长格式化：90061 -> 1天 1小时 1分 1秒 */
function formatDuration(seconds?: number | null): string {
  const raw = toNumber(seconds)
  if (raw === null) return '-'
  const total = Math.max(0, Math.floor(raw))

  const parts: string[] = []
  const day = Math.floor(total / 86400)
  const hour = Math.floor((total % 86400) / 3600)
  const minute = Math.floor((total % 3600) / 60)
  const second = total % 60

  if (day) parts.push(`${day}${t('systemOpsAbout.day')}`)
  if (hour) parts.push(`${hour}${t('systemOpsAbout.hour')}`)
  if (minute) parts.push(`${minute}${t('systemOpsAbout.minute')}`)
  if (!parts.length || second) parts.push(`${second}${t('systemOpsAbout.second')}`)

  return parts.join(' ')
}

/** 时间格式化：ISO / Date -> YYYY-MM-DD HH:mm:ss */
function formatDateTime(value?: string | Date | null): string {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 图表 X 轴时间刻度：HH:mm:ss */
function formatClock(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (num: number) => String(num).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * Get About
 * 获取服务端运行信息（只在手动刷新与页面进入时拉取）
 */
async function loadAbout() {
  aboutLoading.value = true
  try {
    const res = await api.getSystemAbout()
    if (res.code === 2000) {
      about.value = res.data
    } else {
      MessagePlugin.error(res.message ?? t('systemOpsAbout.loadFailed'))
    }
  } catch {
    // 网络异常已由请求拦截器统一提示
  } finally {
    aboutLoading.value = false
  }
}

/**
 * Get Metrics
 * 获取监控采样数据（自动刷新时只拉这个接口）
 */
async function loadMetrics() {
  metricsLoading.value = true
  try {
    const res = await api.getSystemMetrics()
    if (res.code === 2000) {
      metrics.value = res.data
      lastUpdatedAt.value = new Date()
    } else {
      MessagePlugin.error(res.message ?? t('systemOpsAbout.metricsFailed'))
    }
  } catch {
    // 网络异常已由请求拦截器统一提示
  } finally {
    metricsLoading.value = false
  }
}

/** 手动刷新：运行信息与监控数据一起拉 */
async function handleRefresh() {
  await Promise.all([loadAbout(), loadMetrics()])
}

/** 开启自动刷新：每 5 秒拉一次监控数据 */
function startAutoRefresh() {
  stopAutoRefresh()
  autoRefreshTimer = setInterval(() => loadMetrics(), AUTO_REFRESH_INTERVAL)
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
</script>

<style lang="scss" scoped>
.system-ops-about {
  padding: 4px 0;

  .system-ops-about__switch-label {
    font-size: calc(13px * var(--app-font-scale, 1));
    color: var(--td-text-color-secondary);
  }

  .system-ops-about__metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 12px;
  }

  .system-ops-about__metric {
    flex: 1 1 180px;
    min-width: 160px;

    :deep(.t-card__body) {
      padding: 16px;
    }
  }

  .system-ops-about__metric-name {
    font-size: calc(13px * var(--app-font-scale, 1));
    color: var(--td-text-color-secondary);
  }

  .system-ops-about__metric-value {
    margin: 8px 0 6px;
    font-size: calc(26px * var(--app-font-scale, 1));
    font-weight: 600;
    line-height: 1.2;
    color: var(--td-brand-color);
  }

  .system-ops-about__metric-extra {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 22px;
  }

  .system-ops-about__metric-tip {
    font-size: calc(12px * var(--app-font-scale, 1));
    color: var(--td-text-color-placeholder);
    word-break: break-all;
  }

  .system-ops-about__card {
    margin-bottom: 12px;
  }

  .system-ops-about__chart-tip {
    margin-bottom: 4px;
    font-size: calc(12px * var(--app-font-scale, 1));
    color: var(--td-text-color-placeholder);
  }

  .system-ops-about__chart {
    width: 100%;
    height: 320px;
  }

  .system-ops-about__chart--small {
    height: 240px;
  }

  .system-ops-about__distributions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    .system-ops-about__card--half {
      flex: 1 1 320px;
      min-width: 280px;
    }
  }

  .system-ops-about__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 240px;
    font-size: calc(13px * var(--app-font-scale, 1));
    color: var(--td-text-color-placeholder);
  }

  .system-ops-about__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: calc(12px * var(--app-font-scale, 1));
    color: var(--td-text-color-secondary);
  }

  .system-ops-about__footer-time {
    color: var(--td-text-color-placeholder);
  }
}
</style>

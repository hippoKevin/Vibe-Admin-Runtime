<template>
  <t-card class="container">
    <!-- 工具条：文件选择 + 操作按钮。
         这里用显式 flex 做纵向居中：t-space 默认是 inline-flex，按文字基线对齐，
         末尾的「重启服务」按钮会和其它按钮错开一截 -->
    <template #title>
      <div class="system-ops-env__toolbar">
        <t-select
          v-model="envForm.file"
          class="system-ops-env__field"
          :options="envFileOptions"
          :placeholder="$t('systemOpsEnv.filePlaceholder')"
          @change="loadEnvDetail"
        />
        <t-tag v-if="isActiveFile" theme="success" variant="light">
          {{ $t('systemOpsEnv.activeTag') }}
        </t-tag>
        <t-button variant="outline" :loading="envLoading" @click="loadEnvDetail">
          {{ $t('systemOpsEnv.refresh') }}
          <template #icon>
            <RefreshIcon />
          </template>
        </t-button>
        <t-button variant="outline" @click="handleAddEnvItem">
          {{ $t('systemOpsEnv.addItem') }}
        </t-button>
        <t-space align="center" :size="6">
          <span class="system-ops-env__switch-label">{{ $t('systemOpsEnv.showSecret') }}</span>
          <t-switch v-model="showSecret" size="small" />
        </t-space>
        <t-button theme="primary" :loading="envSaving" @click="handleSaveEnv">
          {{ $t('systemOpsEnv.saveAndRestart') }}
        </t-button>
        <t-button theme="danger" variant="outline" :loading="envSaving" @click="handleRestartSystem">
          {{ $t('systemOpsEnv.restartNow') }}
        </t-button>
      </div>
    </template>

    <template #default>
      <div class="system-ops-env">
        <t-alert class="system-ops-env__tip" theme="info" :message="$t('systemOpsEnv.secretTip')" />
        <div class="system-ops-env__hint">{{ $t('systemOpsEnv.backupTip') }}</div>

        <t-loading :loading="envLoading">
          <div class="system-ops-env__panel">
            <div class="system-ops-env__head">
              <span class="system-ops-env__col-key">{{ $t('systemOpsEnv.key') }}</span>
              <span class="system-ops-env__col-value">{{ $t('systemOpsEnv.value') }}</span>
              <span class="system-ops-env__col-action">{{ $t('systemOpsEnv.action') }}</span>
            </div>

            <div v-for="(item, index) in envItems" :key="item.uid" class="system-ops-env__row">
              <!-- 已有行的 key 只读，只有新增行可以改名称 -->
              <div class="system-ops-env__col-key">
                <t-input
                  v-if="item.isNew"
                  v-model="item.key"
                  :placeholder="$t('systemOpsEnv.newKeyPlaceholder')"
                />
                <span v-else class="system-ops-env__name">
                  {{ item.key }}
                  <t-tag v-if="item.secret" theme="warning" variant="light" size="small">
                    {{ $t('systemOpsEnv.secretTag') }}
                  </t-tag>
                </span>
              </div>

              <div class="system-ops-env__col-value">
                <t-input
                  v-model="item.value"
                  :type="item.secret && !showSecret ? 'password' : 'text'"
                  :placeholder="item.secret && item.hasValue
                    ? $t('systemOpsEnv.secretPlaceholder')
                    : $t('systemOpsEnv.valuePlaceholder')"
                />
              </div>

              <div class="system-ops-env__col-action">
                <t-button theme="danger" variant="text" @click="handleDeleteEnvItem(index)">
                  {{ $t('common.delete') }}
                </t-button>
              </div>
            </div>

            <div v-if="!envItems.length" class="system-ops-env__empty">
              {{ $t('systemOpsEnv.envEmpty') }}
            </div>
          </div>
        </t-loading>
      </div>
    </template>

    <template #footer>
      <div class="system-ops-env__footer">
        <span>{{ $t('systemOpsEnv.fileMeta', { file: envResult.file || '-' }) }}</span>
        <span>{{ $t('systemOpsEnv.lineCountTip', { count: envResult.lineCount ?? '-' }) }}</span>
        <span>{{ $t('systemOpsEnv.fileSizeTip', { size: formatBytes(envResult.size) }) }}</span>
        <span>{{ $t('systemOpsEnv.updatedAtTip', { time: formatDateTime(envResult.updatedAt) }) }}</span>
      </div>
    </template>
  </t-card>
</template>

<script lang="ts">
export default { name: 'SystemOpsEnvPage' }
</script>

<script lang="ts" setup>
// 1. 第三方依赖
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { RefreshIcon } from 'tdesign-icons-vue-next'
// 2. 工程内工具
import { useI18n } from 'vue-i18n'
// 3. 接口
import * as api from './api'

const { t } = useI18n()

/** 重启后探测服务是否恢复：最多 30 次，每次间隔 1.5 秒 */
const RESTART_PROBE_MAX = 30
const RESTART_PROBE_INTERVAL = 1500
/** 后端重启前的等待时间（毫秒） */
const RESTART_WAIT = 2000

// 页面打开时
onMounted(() => {
  loadEnvDetail()
})

/**
 * Data Setting
 * 数据配置
 */

/** 配置项行 */
interface EnvRow {
  /** 行唯一标识 */
  uid: number
  key: string
  value: string
  /** 敏感项：接口不回显内容，留空表示不修改 */
  secret: boolean
  /** 敏感项原本是否有值 */
  hasValue: boolean
  /** 是否为新增行（只有新增行允许改名称） */
  isNew: boolean
}

// 配置文件详情加载
const envLoading = ref(false)
// 保存 / 重启进行中
const envSaving = ref(false)
// 配置文件详情（含文件列表、大小、更新时间）
const envResult = ref<any>({ file: '', activeFile: '', files: [], size: 0, lineCount: 0 })
// 当前编辑的配置项
const envItems = ref<EnvRow[]>([])
// 显示敏感值开关
const showSecret = ref(false)
// 文件选择表单
const envForm = ref<{ file?: string }>({ file: undefined })

/** 待删除的配置项名称（保存时才真正从文件移除） */
let deletedKeys: string[] = []
/** 新增行的自增标识，用于 v-for key */
let rowUid = 0

/**
 * Computed Setting
 * 计算配置
 */

/** 当前选中的文件是否为生效文件 */
const isActiveFile = computed(() => !!envForm.value.file && envForm.value.file === envResult.value.activeFile)

/** 配置文件下拉：生效文件加「当前生效」标记 */
const envFileOptions = computed(() =>
  (envResult.value.files || []).map((item: any) => ({
    label: item.active
      ? t('systemOpsEnv.activeFileOption', { name: item.name, tag: t('systemOpsEnv.activeMark') })
      : t('systemOpsEnv.fileWithSize', { name: item.name, size: formatBytes(item.size) }),
    value: item.name
  }))
)

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

/** 延时 */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Get Env Detail
 * 获取环境变量文件详情
 */
async function loadEnvDetail() {
  envLoading.value = true
  try {
    const res = await api.getEnvDetail(envForm.value.file)
    if (res.code !== 2000) {
      MessagePlugin.error(res.message ?? t('systemOpsEnv.detailFailed'))
      return
    }

    envResult.value = res.data
    envForm.value.file = res.data.file
    deletedKeys = []
    envItems.value = (res.data.items || []).map((item: any) => ({
      uid: (rowUid += 1),
      key: item.key,
      value: item.value ?? '',
      secret: !!item.secret,
      hasValue: !!item.hasValue,
      isNew: false
    }))
  } catch {
    // 网络异常已由请求拦截器统一提示
  } finally {
    envLoading.value = false
  }
}

/**
 * Add Env Item
 * 新增一行（新增行的名称可编辑）
 */
function handleAddEnvItem() {
  envItems.value.push({
    uid: (rowUid += 1),
    key: '',
    value: '',
    secret: false,
    hasValue: false,
    isNew: true
  })
}

/**
 * Delete Env Item
 * 删除一行：新增行直接移除，已有行二次确认后记入待删除列表
 */
function handleDeleteEnvItem(index: number) {
  const item = envItems.value[index]
  if (!item) return

  if (item.isNew) {
    envItems.value.splice(index, 1)
    return
  }

  const dialog = DialogPlugin.confirm({
    header: t('systemOpsEnv.deleteTitle'),
    body: t('systemOpsEnv.deleteConfirm', { key: item.key }),
    theme: 'danger',
    confirmBtn: { content: t('common.confirm'), theme: 'danger' },
    onConfirm: () => {
      deletedKeys.push(item.key)
      envItems.value.splice(index, 1)
      dialog.hide()
    }
  })
}

/**
 * Collect Env Items
 * 校验并整理待提交的配置项，校验不通过返回 null
 */
function collectEnvItems(): { key: string; value: string }[] | null {
  const items: { key: string; value: string }[] = []
  const keys = new Set<string>()

  for (const item of envItems.value) {
    const key = String(item.key || '').trim()
    if (!key) {
      MessagePlugin.error(t('systemOpsEnv.keyRequired'))
      return null
    }
    if (keys.has(key)) {
      MessagePlugin.error(t('systemOpsEnv.keyDuplicate', { key }))
      return null
    }
    keys.add(key)
    items.push({ key, value: item.value ?? '' })
  }

  return items
}

/**
 * Save Env
 * 保存并重启：先校验，再二次确认
 */
function handleSaveEnv() {
  const items = collectEnvItems()
  if (!items) return

  const dialog = DialogPlugin.confirm({
    header: t('systemOpsEnv.saveConfirmTitle'),
    body: t('systemOpsEnv.saveConfirmBody'),
    theme: 'warning',
    confirmBtn: { content: t('systemOpsEnv.saveAndRestart'), theme: 'primary' },
    onConfirm: async () => {
      dialog.hide()
      await submitEnv(items)
    }
  })
}

/**
 * Submit Env
 * 提交保存请求，并按重启结果决定是否轮询等待服务恢复
 */
async function submitEnv(items: { key: string; value: string }[]) {
  const file = envResult.value.file || envForm.value.file
  if (!file) {
    MessagePlugin.error(t('systemOpsEnv.detailFailed'))
    return
  }

  envSaving.value = true
  try {
    const res = await api.saveEnv({
      file,
      items,
      deletedKeys,
      restart: true
    })
    if (res.code !== 2000) {
      MessagePlugin.error(res.message ?? t('systemOpsEnv.saveFailed'))
      return
    }

    if (!res.data?.changed) {
      MessagePlugin.info(t('systemOpsEnv.noChange'))
      deletedKeys = []
      await loadEnvDetail()
      return
    }

    MessagePlugin.success(t('systemOpsEnv.saveSuccess'))

    const restart = res.data?.restart || {}
    deletedKeys = []

    // 没有触发重启时刷新页面数据并提示手动重启；触发重启则进入等待恢复流程
    if (!restart.triggered) {
      await loadEnvDetail()
      MessagePlugin.warning(restart.message || t('systemOpsEnv.restartManual'))
      return
    }

    await waitForRestart()
  } catch {
    // 网络异常已由请求拦截器统一提示
  } finally {
    envSaving.value = false
  }
}

/**
 * Restart System
 * 重启服务（不改配置），二次确认后轮询等待服务恢复
 */
function handleRestartSystem() {
  const dialog = DialogPlugin.confirm({
    header: t('systemOpsEnv.restartNowConfirmTitle'),
    body: t('systemOpsEnv.restartNowConfirmBody'),
    theme: 'warning',
    confirmBtn: { content: t('systemOpsEnv.restartNow'), theme: 'primary' },
    onConfirm: async () => {
      dialog.hide()
      envSaving.value = true
      try {
        const res = await api.restartSystem()
        if (res.code !== 2000) {
          MessagePlugin.error(res.message ?? t('systemOpsEnv.restartFailed'))
          return
        }
        await waitForRestart()
      } catch {
        // 网络异常已由请求拦截器统一提示
      } finally {
        envSaving.value = false
      }
    }
  })
}

/**
 * Wait For Restart
 * 轮询等待服务恢复
 *
 * 这里直接用 axios 请求 /proxy 下的探测接口，不走工程封装的 request：
 * 轮询期间服务本来就不可用，封装层会弹出一屏错误提示。
 * 探测接口是公开的，不需要 token。
 */
async function waitForRestart() {
  // MessagePlugin.loading 返回的是 Promise<MessageInstance>，需要 await 才能拿到 close
  const loading = await MessagePlugin.loading({ content: t('systemOpsEnv.restarting'), duration: 0 })

  // 先等重启延迟与服务停止，再开始探测
  await sleep(RESTART_WAIT)

  for (let attempt = 0; attempt < RESTART_PROBE_MAX; attempt += 1) {
    try {
      const res = await axios.get('/proxy/hippoadmin/system-ops/ping', { timeout: 3000 })
      if (res.data?.code === 2000) {
        loading.close()
        MessagePlugin.success(t('systemOpsEnv.restartDone'))
        setTimeout(() => window.location.reload(), 800)
        return
      }
    } catch {
      // 服务还没起来，继续等待下一次探测
    }
    await sleep(RESTART_PROBE_INTERVAL)
  }

  loading.close()
  MessagePlugin.warning(t('systemOpsEnv.restartTimeout'))
}
</script>

<style lang="scss" scoped>@import url("./index.scss");</style>

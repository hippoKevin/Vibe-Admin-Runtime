<template>
    <t-tooltip :content="$t('devMode.button')">
        <t-button ref="triggerRef" variant="text" shape="square" data-testid="dev-mode-trigger" @click="handleTrigger">
            <template #icon>
                <RocketIcon size="20px" />
            </template>
        </t-button>
    </t-tooltip>

    <!-- 独立控制台窗口开着时：主页面盖一层浅色幕（pointer-events: none，不挡点击） -->
    <Teleport to="body">
        <div v-if="consoleOpened" class="dev-mode-veil" data-testid="dev-mode-veil"></div>
    </Teleport>
</template>

<script lang="ts">
export default {
    name: 'DevModeTool',
}
</script>

<script lang="ts" setup>
// 1. 第三方依赖
import { RocketIcon } from 'tdesign-icons-vue-next'
import { MessagePlugin } from 'tdesign-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'
// 2. 工程内工具
import { useI18n } from 'vue-i18n'
import router from '@/router'
import { useUserStore } from '@/stores/userStore'

/**
 * 开发模式：启动器 + 浅色幕 + 消息监听
 *
 * 真正的开发模式界面（球体神经网络 / 音轨 / 执行过程面板）已经搬到独立控制台窗口里：
 * 那个页面由后端直接吐出、不经过 Vite，Agent 改代码触发的热更新/整页刷新不会把它刷掉。
 * 本组件只负责：
 *   1) 打开/聚焦独立控制台窗口；
 *   2) 窗口开着时给主页面加一层不挡点击的浅色幕（窗口关闭后自动移除）；
 *   3) 收到控制台「任务完成」消息后，把改动文件映射到菜单路由并跳转过去。
 */

const { t } = useI18n()
const userStore = useUserStore()

/** 控制台页面地址（与主页面同源：开发走 Vite 代理，生产走 nginx 代理） */
const CONSOLE_PATH = '/hippoadmin/dev-agent/console'
/** 窗口名：同名窗口只存在一个，重复点击只聚焦 */
const CONSOLE_NAME = 'vibeAdminDevModeConsole'
/** 控制台窗口尺寸 */
const CONSOLE_FEATURES = 'width=560,height=860,menubar=no,toolbar=no'
/** 控制台完成一次任务后回传的消息类型 */
const APPLIED_MESSAGE = 'vibe-admin-dev-applied'
/** 关闭检测的轮询间隔（毫秒） */
const CLOSE_POLL_INTERVAL = 800
/** Agent 自身目录下的改动不参与页面跳转（归一化后的小写前缀） */
const AGENT_DIR_PREFIX = 'adminagent/'

/** 改动文件（控制台回传） */
interface DevAppliedFile {
    status?: string
    path?: string
}

/** 控制台回传的消息 */
interface DevAppliedMessage {
    type?: string
    files?: DevAppliedFile[]
}

/** 菜单里的一个可跳转页面 */
interface MenuPage {
    /** 路由名（本项目路由就是 /组件名） */
    name: string
    /** 菜单配置的组件地址，形如 /src/pages/SystemOps/Log/index.vue */
    address: string
}

const triggerRef = ref<any>(null)

/** 控制台窗口是否开着：决定主页面浅色幕的显隐 */
const consoleOpened = ref(false)

/** 控制台窗口句柄 */
let consoleWin: Window | null = null

/** win.closed 轮询定时器 */
let closeTimer: ReturnType<typeof setInterval> | null = null

/**
 * Method Setting
 * 方法配置
 */

/** 打开独立控制台窗口（已打开则聚焦，不重复开） */
function handleTrigger() {
    if (consoleWin && !consoleWin.closed) {
        consoleWin.focus()
        return
    }

    const token = localStorage.getItem('token') || ''
    if (!token) {
        MessagePlugin.warning(t('devMode.notLoggedIn'))
        return
    }

    const win = window.open(`${CONSOLE_PATH}#token=${encodeURIComponent(token)}`, CONSOLE_NAME, CONSOLE_FEATURES)
    if (!win) {
        MessagePlugin.warning(t('devMode.popupBlocked'))
        return
    }

    consoleWin = win
    consoleOpened.value = true
    startCloseWatch()
    win.focus()
}

/** 轮询控制台窗口是否被关闭：关了就撤掉浅色幕 */
function startCloseWatch() {
    clearCloseTimer()
    closeTimer = setInterval(() => {
        let closed = true
        try {
            closed = !consoleWin || consoleWin.closed
        } catch {
            // 拿不到句柄状态时按「已关闭」处理，避免浅色幕残留
            closed = true
        }
        if (closed) stopCloseWatch()
    }, CLOSE_POLL_INTERVAL)
}

/** 只清理定时器（开始监听时用，不能顺手清掉窗口状态） */
function clearCloseTimer() {
    if (closeTimer) {
        clearInterval(closeTimer)
        closeTimer = null
    }
}

/** 停止轮询并撤掉浅色幕 */
function stopCloseWatch() {
    clearCloseTimer()
    consoleWin = null
    consoleOpened.value = false
}

/**
 * Router Setting
 * 改动文件 → 菜单路由
 */

/** 路径归一化：统一分隔符、去掉开头 './'、转小写 */
function normalizePath(value: string): string {
    return String(value || '')
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .toLowerCase()
}

/** child 是否是 parent 的「整段路径后缀」 */
function isPathSuffix(child: string, parent: string): boolean {
    if (!parent || child.length <= parent.length || !child.endsWith(parent)) return false
    // 菜单地址形如 /src/...，本身自带路径边界
    if (parent.startsWith('/')) return true
    return child.charAt(child.length - parent.length - 1) === '/'
}

/**
 * 后缀归一化比对：
 * 菜单 /src/pages/SystemOps/Log/index.vue ↔ 改动文件 ADMINCLIENT/src/pages/SystemOps/Log/index.vue
 */
function isSamePageFile(address: string, filePath: string): boolean {
    const menuPath = normalizePath(address)
    const changedPath = normalizePath(filePath)
    if (!menuPath || !changedPath) return false
    if (menuPath === changedPath) return true
    return isPathSuffix(changedPath, menuPath) || isPathSuffix(menuPath, changedPath)
}

/** 递归收集菜单树里所有「带组件地址」的页面 */
function collectMenuPages(): MenuPage[] {
    const pages: MenuPage[] = []

    const walk = (list: any[]) => {
        for (const item of list || []) {
            if (item?.component_address && item?.component_name) {
                pages.push({
                    name: String(item.component_name),
                    address: String(item.component_address),
                })
            }
            if (Array.isArray(item?.children) && item.children.length) walk(item.children)
        }
    }

    const menus = (userStore.userInfo as any)?.data?.menu_list
    walk(Array.isArray(menus) ? menus : [])
    return pages
}

/** 从改动文件里挑出要跳转的页面：命中多个时取第一个非 ADMINAGENT/ 的前端页面 */
function resolvePageRoute(files: DevAppliedFile[]): MenuPage | null {
    const pages = collectMenuPages()
    const hits: { page: MenuPage; path: string }[] = []

    for (const file of files) {
        const filePath = String(file?.path || '')
        if (!filePath) continue

        const hit = pages.find((page) => isSamePageFile(page.address, filePath))
        if (hit) hits.push({ page: hit, path: filePath })
    }

    const frontend = hits.find((item) => !normalizePath(item.path).startsWith(AGENT_DIR_PREFIX))
    return frontend ? frontend.page : null
}

/** 控制台任务完成：把被改动的文件映射成菜单路由并跳过去 */
function handleConsoleMessage(event: MessageEvent) {
    const data = event.data as DevAppliedMessage | null
    // 只认自己的消息类型，避免误响应其他 postMessage
    if (!data || typeof data !== 'object' || data.type !== APPLIED_MESSAGE) return

    const files = Array.isArray(data.files) ? data.files : []
    if (!files.length) return

    const target = resolvePageRoute(files)
    if (!target) {
        MessagePlugin.info(t('devMode.appliedNoMatch'))
        return
    }

    MessagePlugin.success(t('devMode.appliedJump', { name: target.name }))
    router.push(`/${target.name}`)
}

onMounted(() => {
    window.addEventListener('message', handleConsoleMessage)
})

onBeforeUnmount(() => {
    window.removeEventListener('message', handleConsoleMessage)
    stopCloseWatch()
})
</script>

<style lang="scss" scoped>@import url("./index.scss");</style>

<template>
    <t-tooltip :content="$t('devMode.button')">
        <t-button
            ref="triggerRef"
            variant="text"
            shape="square"
            data-testid="dev-mode-trigger"
            @click="handleTrigger"
        >
            <template #icon>
                <RocketIcon size="20px" />
            </template>
        </t-button>
    </t-tooltip>
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
import { nextTick, ref } from 'vue'
// 2. 工程内工具
import { useI18n } from 'vue-i18n'
import { devModeOpen, openDevMode, toggleDevMode } from '@/utils/devMode'

/**
 * 开发模式：顶栏开关按钮
 *
 * 开发模式的界面本体已经不在这里 —— 它是 App.vue 里挂载的 DevModeConsole
 * 原生组件（跟系统一体，只蒙一层幕布）。本组件只负责切换开关：
 *   1) 没开就打开（状态持久化在 localStorage，整页刷新后会自动恢复）；
 *   2) 已开就关闭。
 * 任务完成后的「跳转到被改动的页面」由 DevModeConsole 自己处理（同进程，不再用 postMessage）。
 */

const { t } = useI18n()

const triggerRef = ref<any>(null)

/** 切换开发模式：已打开就关闭，未打开就打开 */
function handleTrigger() {
    // 点完就把焦点移开，避免 tooltip 一直挂着影响看幕布内容
    nextTick(() => {
        const instance = triggerRef.value
        const el = (instance?.$el || instance) as HTMLElement | undefined
        el?.blur?.()
    })

    if (devModeOpen.value) {
        toggleDevMode()
        return
    }

    let token = ''
    try {
        token = localStorage.getItem('token') || ''
    } catch {
        token = ''
    }
    if (!token) {
        MessagePlugin.warning(t('devMode.notLoggedIn'))
        return
    }

    openDevMode()
}
</script>

<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { RouterView, useRoute } from 'vue-router'
  import zhConfig from 'tdesign-vue-next/es/locale/zh_CN'
  import enConfig from 'tdesign-vue-next/es/locale/en_US'
  import { useI18n } from 'vue-i18n'
  import { initTheme } from '@/utils/theme'
  import { initFontScale } from '@/utils/fontScale'
  // 开发模式：应用内的原生组件（挂这里，不随路由/页面级热更新卸载）
  import DevModeConsole from '@/components/DevModeConsole/index.vue'
  import { devModeOpen } from '@/utils/devMode'

  const { locale } = useI18n()
  const route = useRoute()

  // 应用已保存的主题色（明暗模式色板）
  initTheme()

  // 应用已保存的字号缩放
  initFontScale()

  // 登录页会强制亮色主题，离开登录页时用存储的明暗模式/主题色重新初始化
  watch(
    () => route.path,
    (path) => {
      if (path !== '/login') {
        initTheme()
      }
    }
  )

  const tdGlobalConfig = computed(() => {
    return locale.value === 'zh-CN' ? zhConfig : enConfig
  })
</script>

<template>
  <t-config-provider :globalConfig="tdGlobalConfig">
    <RouterView />

    <!--
      开发模式：原生 Vue 组件 + 一层浅色幕布（不是弹窗、不是 iframe、不开新窗口）。
      挂载点固定在 App.vue，页面级热更新不会把它卸载；开关/草稿/面板状态存 localStorage，
      整页刷新后会自动恢复，并向后端接回正在跑的任务。
    -->
    <DevModeConsole v-if="devModeOpen" />
  </t-config-provider>
</template>

<style lang="scss">
  @import url("./index.scss");
</style>

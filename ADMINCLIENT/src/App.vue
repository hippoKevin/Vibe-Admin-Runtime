<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { RouterView, useRoute } from 'vue-router'
  import zhConfig from 'tdesign-vue-next/es/locale/zh_CN'
  import enConfig from 'tdesign-vue-next/es/locale/en_US'
  import { useI18n } from 'vue-i18n'
  import { initTheme } from '@/utils/theme'

  const { locale } = useI18n()
  const route = useRoute()

  // 应用已保存的主题色（明暗模式色板）
  initTheme()

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
  </t-config-provider>
</template>

<style lang="scss">
  @import url("./index.scss");
</style>

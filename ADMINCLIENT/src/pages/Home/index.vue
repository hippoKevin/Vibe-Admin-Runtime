<template>
    <t-layout style="height: 100vh; overflow: hidden;">
        <t-header style="border-bottom: 1px solid var(--td-component-stroke);">
            <layout-header />
        </t-header>
        <t-layout>
            <layout-side-nav />
            <layout-content />
        </t-layout>
    </t-layout>

</template>

<script lang="ts">
export default { name: 'HomePage' }
</script>

<script setup lang="ts">
import { onMounted } from 'vue'

import LayoutHeader from './components/LayoutHeader.vue'
import LayoutSideNav from './components/LayoutSideNav.vue'
import LayoutContent from './components/LayoutContent.vue'
import {initTheme} from '@/utils/theme'

onMounted(() => {
    // 检查颜色主题
    initTheme()
})
</script>

<style lang="scss" scoped>
@import url("./index.scss");
</style>

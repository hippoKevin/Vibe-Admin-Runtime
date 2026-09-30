<template>
  <!-- 技能管理：ADMINAGENT/skills（与 Agent / Tool 页共用 AssetPanel） -->
  <div class="container">
    <AssetPanel kind="skill" :api="api" />
  </div>
</template>

<script lang="ts">
export default { name: 'AgentAdminSkillPage' }
</script>

<script lang="ts" setup>
// 1. 第三方依赖：无（页面只做壳，交互都在 AssetPanel 里）
// 2. 工程内工具
import AssetPanel from '../components/AssetPanel/index.vue'
// 3. 接口
import * as api from './api'
</script>

<style lang="scss" scoped>@import url("./index.scss");</style>

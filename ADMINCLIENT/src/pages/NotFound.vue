<template>
    <div class="not-found-container">
      <!-- 数字 404 动态效果 -->
      <div class="error-number">
        <span class="num-4">4</span>
        <span class="num-0">0</span>
        <span class="num-4">4</span>
      </div>
      <!-- 提示文本 -->
      <h1 class="error-title">{{ $t('notFound.title') }}</h1>
      <p class="error-desc">
        {{ $t('notFound.desc') }}
      </p>
      <!-- 返回按钮 -->
      <button 
        class="back-home-btn"
        @click="handleBackHome"
      >
        {{ $t('notFound.backHome') }}
      </button>
    </div>
  </template>
  
  <script lang="ts">
  export default {
    name: 'NotFound'
  }
  </script>
  
  <script setup lang="ts">
  import { useRouter } from 'vue-router'
  
  // 路由实例，用于返回首页
  const router = useRouter()
  
  // 返回首页事件
  const handleBackHome = () => {
    router.push('/')
  }
  </script>
  
  <style lang="scss" scoped>@import url("./index.scss");</style>

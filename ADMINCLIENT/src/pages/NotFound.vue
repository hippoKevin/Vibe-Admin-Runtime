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
  
  <style lang="scss" scoped>
  // 容器全屏居中
  .not-found-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #f8f9fa;
    padding: 20px;
    box-sizing: border-box;
  }
  
  // 404 数字样式（带悬浮动画）
  .error-number {
    font-size: 120px;
    font-weight: 700;
    margin-bottom: 20px;
    display: flex;
    gap: 15px;
  
    .num-4, .num-0 {
      color: #333;
      transition: all 0.3s ease;
  
      &:hover {
        transform: scale(1.1);
        color: #409eff; // Vue 主题色，可替换
        cursor:default;
      }
    }
  
    .num-0 {
      // 0 单独加旋转动画
      animation: rotate 3s linear infinite;
    }
  }
  
  // 标题和描述文本
  .error-title {
    font-size: 24px;
    color: #333;
    margin-bottom: 10px;
  }
  
  .error-desc {
    font-size: 16px;
    color: #666;
    margin-bottom: 30px;
    text-align: center;
    max-width: 500px;
  }
  
  // 返回按钮样式（带 hover 和点击效果）
  .back-home-btn {
    padding: 12px 24px;
    background-color: #409eff;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
  
    &:hover {
      background-color: #66b1ff;
      transform: translateY(-2px);
    }
  
    &:active {
      transform: translateY(0);
    }
  }
  </style>

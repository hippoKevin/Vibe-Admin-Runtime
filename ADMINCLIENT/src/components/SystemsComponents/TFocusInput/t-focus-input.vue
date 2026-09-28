<template>
    <t-input ref="inputRef" v-bind="attrs" @focus="handleFocus" />
  </template>
  
  <script setup lang="ts">
  import { ref, useAttrs } from 'vue'
  
  defineOptions({
    name: 'TFocusInput',
    inheritAttrs: false
  })
  
  const attrs = useAttrs()
  const inputRef = ref(null)
  
  const handleFocus = (e: FocusEvent) => {
    const nativeInput = inputRef.value?.$el?.querySelector('input')
    if (nativeInput) {
      setTimeout(() => nativeInput.select(), 0)
    }
  
    // 转发父组件自己传入的 @focus，避免被覆盖丢失
    if (typeof attrs.onFocus === 'function') {
      attrs.onFocus(e)
    } else if (Array.isArray(attrs.onFocus)) {
      attrs.onFocus.forEach(fn => fn(e))
    }
  }
  </script>
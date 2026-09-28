<template>
  <t-tooltip :content="$t('header.switchLanguage')">
    <t-space :size="1" :class="props.source === 'login' ? 'swichLanguageButtonLogin' : 'swichLanguageButton'" variant="text" shape="square" @click="toggleLocale">
      <TranslateIcon size="18px"/>
      <span class="lang-label">{{ currentLabel }}</span>
    </t-space>
  </t-tooltip>
</template>

<script lang="ts">
export default {
  name: 'LanguageSwitcher',
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { TranslateIcon } from 'tdesign-icons-vue-next'
import { useI18n } from 'vue-i18n'
import { setAppLocale, type AppLocale } from '@/locales'

const props = defineProps({
  source: {type: String, default: null}
});

const { locale } = useI18n()

const currentLabel = computed(() => {
  // 展示点击后将要切换到的语言
  return locale.value === 'zh-CN' ? 'EN' : '中'
})

function toggleLocale() {
  const next: AppLocale = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  setAppLocale(next)
}
</script>

<style scoped>
.lang-label {
  font-size: 12px;
  font-weight: 600;
  margin-left: 2px;
}

.swichLanguageButton {
  cursor: pointer;
  border-radius: 2px;
  padding: 0 8px;

  transition: all 0.5s;
  &:hover {
    background-color: rgb(225, 225, 225);
  }
}

.swichLanguageButtonLogin {
  cursor: pointer;
  border-radius: 2px;
  padding: 0 10px 4px 10px;
  margin-top: 10px;

  transition: all 0.5s;
  &:hover {
    background-color: rgb(225, 225, 225);
  }
}
</style>

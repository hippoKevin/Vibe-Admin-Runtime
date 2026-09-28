<template>
  <t-popup trigger="click" placement="bottom-right" attach="body" destroyOnClose
    :overlayInnerStyle="{ width: '220px', borderRadius: '6px', padding: '0' }">
    <template #triggerElement>
      <t-tooltip :content="$t('themeColors.title')">
        <t-button variant="text" shape="square">
          <template #icon>
            <PaletteIcon size="20px" />
          </template>
        </t-button>
      </t-tooltip>
    </template>

    <template #content>
      <div class="theme-config">
        <div class="theme-config__label">{{ $t('themeColors.title') }}</div>
        <div class="theme-config__colors">
          <t-tooltip
            v-for="color in PRESET_THEME_COLORS"
            :key="color.value"
            :content="$t(color.nameKey)"
            placement="top"
          >
            <div
              class="theme-config__color"
              :class="{ 'theme-config__color--active': currentColor === color.value }"
              :style="{ backgroundColor: color.value }"
              @click="handleSelect(color.value)"
            >
              <t-icon v-if="currentColor === color.value" name="check" size="16px" />
            </div>
          </t-tooltip>
        </div>

        <div class="theme-config__divider"></div>

        <div class="theme-config__row">
          <span class="theme-config__row-label">{{ $t('themeColors.darkMode') }}</span>
          <t-switch
            :value="themeMode"
            :customValue="['dark', 'light']"
            :label="[$t('header.themeNight'), $t('header.themeDay')]"
            @change="handleModeChange"
          />
        </div>
      </div>
    </template>
  </t-popup>
</template>

<script lang="ts">
export default {
  name: 'ThemeSwitcher',
}
</script>

<script setup lang="ts">
import { ref } from 'vue'
import { PaletteIcon } from 'tdesign-icons-vue-next'
import { PRESET_THEME_COLORS, getThemeColor, setThemeColor, themeMode } from '@/utils/theme'
import { switchThemeWithCurtain } from '@/utils/themeTransition'

const currentColor = ref(getThemeColor())

function handleSelect(value: string) {
  currentColor.value = value
  setThemeColor(value)
}

function handleModeChange(value: any) {
  switchThemeWithCurtain(value === 'dark' ? 'dark' : 'light')
}
</script>

<style scoped>
.theme-config {
  padding: 12px;
}

.theme-config__label {
  font-size: 13px;
  color: var(--td-text-color-primary);
  margin-bottom: 10px;
}

.theme-config__colors {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-config__color {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 0 0 2px var(--td-bg-color-container), 0 0 0 4px var(--td-brand-color-light-active);
  }
}

.theme-config__color--active {
  box-shadow: 0 0 0 2px var(--td-bg-color-container), 0 0 0 4px var(--td-brand-color);
}

.theme-config__divider {
  height: 1px;
  background: var(--td-component-stroke);
  margin: 12px 0;
}

.theme-config__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.theme-config__row-label {
  font-size: 13px;
  color: var(--td-text-color-primary);
}
</style>

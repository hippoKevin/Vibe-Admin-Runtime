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

        <div class="theme-config__divider"></div>

        <div class="theme-config__brightness">
          <div class="theme-config__row">
            <span class="theme-config__row-label">{{ $t('themeColors.brightness') }}</span>
            <t-tooltip :content="$t('themeColors.brightnessReset')" placement="top">
              <span
                class="theme-config__brightness-value"
                :class="{ 'theme-config__brightness-value--default': brightness === BRIGHTNESS_DEFAULT }"
                @click="handleBrightnessReset"
              >
                {{ brightness }}%
              </span>
            </t-tooltip>
          </div>

          <t-slider
            v-model="brightness"
            :min="BRIGHTNESS_MIN"
            :max="BRIGHTNESS_MAX"
            :step="BRIGHTNESS_STEP"
            :label="false"
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
import { computed, ref } from 'vue'
import { PaletteIcon } from 'tdesign-icons-vue-next'
import {
  BRIGHTNESS_DEFAULT,
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  PRESET_THEME_COLORS,
  getBrightness,
  getThemeColor,
  setBrightness,
  setThemeColor,
  themeMode,
} from '@/utils/theme'
import { switchThemeWithCurtain } from '@/utils/themeTransition'

/** 亮度滑杆步长（%） */
const BRIGHTNESS_STEP = 5

const currentColor = ref(getThemeColor())

/** 亮度：读取时收敛到合法范围，写入时持久化并即时生效 */
const brightness = computed({
  get: () => getBrightness(),
  set: (value: number) => setBrightness(value),
})

function handleSelect(value: string) {
  currentColor.value = value
  setThemeColor(value)
}

function handleModeChange(value: any) {
  switchThemeWithCurtain(value === 'dark' ? 'dark' : 'light')
}

function handleBrightnessReset() {
  brightness.value = BRIGHTNESS_DEFAULT
}
</script>

<style scoped>
.theme-config {
  padding: 12px;
}

.theme-config__label {
  font-size: calc(13px * var(--app-font-scale, 1));
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
  font-size: calc(13px * var(--app-font-scale, 1));
  color: var(--td-text-color-primary);
}

.theme-config__brightness {
  margin-top: 2px;
}

.theme-config__brightness :deep(.t-slider) {
  margin-top: 6px;
}

.theme-config__brightness-value {
  font-size: calc(12px * var(--app-font-scale, 1));
  color: var(--td-text-color-secondary);
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}

.theme-config__brightness-value:hover {
  color: var(--td-brand-color);
}

.theme-config__brightness-value--default {
  color: var(--td-text-color-placeholder);
}
</style>

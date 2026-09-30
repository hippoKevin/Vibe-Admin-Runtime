<template>
  <t-popup trigger="click" placement="bottom-right" attach="body" destroyOnClose
    :overlayInnerStyle="{ width: '240px', borderRadius: '6px', padding: '0' }">
    <template #triggerElement>
      <t-tooltip :content="$t('fontScale.title')">
        <t-button variant="text" shape="square">
          <template #icon>
            <span class="font-scale-entry">A</span>
          </template>
        </t-button>
      </t-tooltip>
    </template>

    <template #content>
      <div class="font-scale">
        <div class="font-scale__row">
          <span class="font-scale__label">{{ $t('fontScale.title') }}</span>
          <t-tooltip :content="$t('fontScale.reset')" placement="top">
            <span
              class="font-scale__value"
              :class="{ 'font-scale__value--default': fontScale === FONT_SCALE_DEFAULT }"
              @click="handleReset"
            >
              {{ fontScale }}%
            </span>
          </t-tooltip>
        </div>

        <div class="font-scale__control">
          <t-button
            size="small"
            shape="square"
            variant="outline"
            :disabled="fontScale <= FONT_SCALE_MIN"
            @click="handleStep(-FONT_SCALE_STEP)"
          >
            <span class="font-scale__sign font-scale__sign--small">A</span>
          </t-button>

          <t-slider
            v-model="fontScale"
            class="font-scale__slider"
            :min="FONT_SCALE_MIN"
            :max="FONT_SCALE_MAX"
            :step="FONT_SCALE_STEP"
            :label="false"
          />

          <t-button
            size="small"
            shape="square"
            variant="outline"
            :disabled="fontScale >= FONT_SCALE_MAX"
            @click="handleStep(FONT_SCALE_STEP)"
          >
            <span class="font-scale__sign">A</span>
          </t-button>
        </div>

        <t-radio-group
          v-model="fontScale"
          class="font-scale__presets"
          variant="default-filled"
          size="small"
        >
          <t-radio-button
            v-for="preset in FONT_SCALE_PRESETS"
            :key="preset.value"
            :value="preset.value"
          >
            {{ $t(preset.nameKey) }}
          </t-radio-button>
        </t-radio-group>
      </div>
    </template>
  </t-popup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_PRESETS,
  FONT_SCALE_STEP,
  getFontScale,
  setFontScale,
} from '@/utils/fontScale'

/** 当前缩放值：读取时收敛到合法范围，写入时持久化并即时生效 */
const fontScale = computed({
  get: () => getFontScale(),
  set: (value: number) => setFontScale(value),
})

function handleStep(offset: number) {
  fontScale.value = fontScale.value + offset
}

function handleReset() {
  fontScale.value = FONT_SCALE_DEFAULT
}
</script>

<style lang="scss" scoped>@import url("./index.scss");</style>

<template>
  <!-- TTS 管理：管理输出音频的音色 + 其它影响输出声音的变量 -->
  <div class="container">
    <t-card class="tts">
      <!-- 工具条：标题 + 可达状态 + 未保存提示 + 保存 -->
      <template #title>
        <t-space align="center" :size="12">
          <span class="tts__title">{{ $t('agentAdmin.ttsTitle') }}</span>
          <t-tag v-if="status" :theme="status.reachable ? 'success' : 'danger'" variant="light" size="small">
            {{ status.reachable
              ? $t('agentAdmin.ttsReachable', { url: status.baseUrl })
              : $t('agentAdmin.ttsUnreachable', { url: status.baseUrl }) }}
          </t-tag>
        </t-space>
      </template>

      <template #actions>
        <t-space align="center" :size="8">
          <t-tag v-if="dirty" theme="warning" variant="light-outline" size="small">
            {{ $t('agentAdmin.ttsDirty') }}
          </t-tag>
          <t-tag v-else theme="success" variant="light-outline" size="small">
            {{ $t('agentAdmin.ttsSaved') }}
          </t-tag>
          <t-button variant="outline" size="small" :loading="statusLoading" @click="loadAll">
            {{ $t('agentAdmin.ttsRefresh') }}
          </t-button>
          <t-button theme="primary" size="small" :loading="saving" :disabled="!ready || !dirty" @click="handleSave">
            {{ saving ? $t('agentAdmin.ttsSaving') : $t('agentAdmin.ttsSave') }}
          </t-button>
        </t-space>
      </template>

      <!-- 内容：左栏音色 / 右栏参数 + 试听，各自内部滚动 -->
      <template #default>
        <div class="tts__body">
          <!-- 不可达：顶部显著提示 + 启动命令，试听按钮禁用但允许改参数并保存 -->
          <t-alert
            v-if="status && !status.reachable"
            class="tts__alert"
            theme="error"
            :title="$t('agentAdmin.ttsUnreachable', { url: status.baseUrl })"
          >
            <template #message>
              <div class="tts__alert-line">{{ $t('agentAdmin.ttsStartHint') }}</div>
              <div v-if="status.hint" class="tts__alert-line">{{ status.hint }}</div>
            </template>
          </t-alert>

          <t-alert
            v-else-if="status && !status.items.length"
            class="tts__alert"
            theme="warning"
            :message="$t('agentAdmin.ttsNoVoice')"
          />

          <div class="tts__panes">
            <!-- 音色区 -->
            <section class="tts__voice">
              <div class="tts__section-head">
                <span class="tts__section-title">{{ $t('agentAdmin.ttsVoiceSection') }}</span>
                <span class="tts__section-meta">{{ $t('agentAdmin.ttsVoiceCount', { count: voices.length }) }}</span>
              </div>

              <div class="tts__voice-current">
                <span>{{ model.voice ? $t('agentAdmin.ttsVoiceCurrent', { name: model.voice }) : $t('agentAdmin.ttsVoiceNone') }}</span>
                <span class="tts__voice-dir" :title="voicesDir">{{ $t('agentAdmin.ttsVoicesDir', { path: voicesDir }) }}</span>
              </div>

              <div class="tts__voice-list">
                <t-loading :loading="loading" size="small">
                  <div v-if="!voices.length" class="tts__empty">{{ $t('agentAdmin.ttsNoVoice') }}</div>
                  <label
                    v-for="voice in voices"
                    :key="voice.name"
                    class="tts__voice-item"
                    :class="{ 'tts__voice-item--active': model.voice === voice.name }"
                  >
                    <t-radio v-model="model.voice" :value="voice.name" @change="markDirty">
                      <span class="tts__voice-name">{{ voice.name }}</span>
                    </t-radio>
                    <span class="tts__voice-size">{{ formatBytes(voice.size) }}</span>
                    <t-button
                      size="small"
                      variant="text"
                      theme="primary"
                      :loading="auditionVoice === voice.name"
                      :disabled="!canSynthesize"
                      @click.prevent="handleAudition(voice.name)"
                    >
                      {{ auditionVoice === voice.name ? $t('agentAdmin.ttsAuditioning') : $t('agentAdmin.ttsAudition') }}
                    </t-button>
                  </label>
                </t-loading>
              </div>
            </section>

            <!-- 参数区 + 试听区 -->
            <section class="tts__main">
              <div class="tts__scroll">
                <div class="tts__toolbar">
                  <span class="tts__section-title">{{ $t('agentAdmin.ttsParamSection') }}</span>
                  <span class="tts__section-meta">{{ $t('agentAdmin.ttsParamTip') }}</span>
                  <div class="tts__toolbar-right">
                    <span class="tts__lang-label">{{ $t('agentAdmin.ttsLang') }}</span>
                    <t-select v-model="model.lang" class="tts__lang-select" :options="langOptions" @change="markDirty" />
                    <t-button size="small" variant="outline" @click="resetParams">
                      {{ $t('agentAdmin.ttsResetDefault') }}
                    </t-button>
                  </div>
                </div>

                <div v-for="group in paramGroups" :key="group.title" class="tts__group">
                  <div class="tts__group-title">{{ group.title }}</div>
                  <div class="tts__params">
                    <div v-for="param in group.params" :key="param.key" class="tts__param" :data-param="param.key">
                      <div class="tts__param-label" :title="param.tip">
                        <span>{{ param.label }}</span>
                        <t-tooltip :content="param.tip" placement="top-left">
                          <t-icon name="help-circle" class="tts__param-help" />
                        </t-tooltip>
                      </div>

                      <!-- 开关：随机采样 / 情感随机采样 -->
                      <div v-if="param.type === 'boolean'" class="tts__param-switch">
                        <t-switch
                          :value="Boolean(model.params[param.key])"
                          @change="(value: any) => setParam(param.key, Boolean(value))"
                        />
                      </div>

                      <!-- 情感描述文本 -->
                      <div v-else-if="param.type === 'string'" class="tts__param-text">
                        <t-input
                          :value="String(model.params[param.key] ?? '')"
                          :placeholder="$t('agentAdmin.ttsParamEmoTextPlaceholder')"
                          @change="(value: any) => setParam(param.key, String(value ?? ''))"
                        />
                      </div>

                      <!-- 数值：滑块 + 数字输入（两边同步） -->
                      <div v-else class="tts__param-value">
                        <t-slider
                          class="tts__param-slider"
                          :min="param.min"
                          :max="param.max"
                          :step="param.step"
                          :value="Number(model.params[param.key])"
                          @change="(value: any) => setParam(param.key, Number(value))"
                        />
                        <t-input-number
                          class="tts__param-number"
                          theme="column"
                          :min="param.min"
                          :max="param.max"
                          :step="param.step"
                          :decimal-places="param.decimals"
                          :value="Number(model.params[param.key])"
                          @change="(value: any) => setParam(param.key, Number(value))"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 试听区 -->
                <div class="tts__group">
                  <div class="tts__group-title">{{ $t('agentAdmin.ttsPreviewSection') }}</div>
                  <div class="tts__preview">
                    <t-textarea
                      v-model="previewText"
                      class="tts__preview-text"
                      :maxlength="500"
                      :autosize="{ minRows: 2, maxRows: 3 }"
                      :placeholder="$t('agentAdmin.ttsPreviewTextPlaceholder')"
                    />
                    <div class="tts__preview-actions">
                      <t-button
                        theme="primary"
                        :loading="previewing"
                        :disabled="!canSynthesize || !previewText.trim()"
                        @click="handlePreview"
                      >
                        {{ previewing ? $t('agentAdmin.ttsPreviewing') : $t('agentAdmin.ttsPreview') }}
                      </t-button>
                      <span class="tts__preview-tip">{{ canSynthesize ? '' : $t('agentAdmin.ttsPreviewDisabled') }}</span>
                    </div>

                    <div class="tts__player">
                      <span class="tts__player-label">{{ $t('agentAdmin.ttsAudioLabel') }}</span>
                      <audio
                        v-if="audioUrl"
                        class="tts__player-audio"
                        :src="audioUrl"
                        controls
                        autoplay
                        @play="playing = true"
                        @pause="playing = false"
                      />
                      <span v-else class="tts__player-empty">
                        {{ loadingAudio ? $t('agentAdmin.ttsAudioLoading') : $t('agentAdmin.ttsAudioNone') }}
                      </span>
                    </div>

                    <div v-if="previewResult" class="tts__player-meta">
                      <span>{{ $t('agentAdmin.ttsAudioSampleRate', { rate: sampleRateText }) }}</span>
                      <span>{{ $t('agentAdmin.ttsAudioDuration', { duration: formatMs(previewResult.audioMs) }) }}</span>
                      <span>{{ $t('agentAdmin.ttsAudioSize', { size: formatBytes(previewResult.bytes) }) }}</span>
                      <span>{{ $t('agentAdmin.ttsPreviewDone', { ms: `${previewResult.ms}ms` }) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </template>
    </t-card>
  </div>
</template>

<script lang="ts">
export default { name: 'AgentAdminTtsPage' }
</script>

<script lang="ts" setup>
// 1. 第三方依赖
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
// 2. 工程内工具
import { translateServerText } from '@/locales'
// 3. 接口
import * as api from './api'

const { t } = useI18n()

/**
 * Data Setting
 * 数据配置
 */
const loading = ref(false)
const saving = ref(false)
const statusLoading = ref(false)
const previewing = ref(false)
const loadingAudio = ref(false)
/** 浏览器是否正在播放试听音频（只用来反映状态，播放由原生控件控制） */
const playing = ref(false)
const auditionVoice = ref('')
/** 有未保存的修改（改了参数 / 换了音色就置位，保存成功后清掉） */
const dirty = ref(false)
const ready = ref(false)
const status = ref<api.TtsStatus | null>(null)
const voices = ref<api.TtsVoiceItem[]>([])
const previewResult = ref<api.TtsPreviewResult | null>(null)
const previewText = ref('')
const audioUrl = ref('')
const voicesDir = ref('')

/** 与后端同样的默认值：文件不存在或改坏了也能把表单填满 */
const DEFAULT_PARAMS: api.TtsParams = {
  emoWeight: 0.65,
  vec1: 0, vec2: 0, vec3: 0, vec4: 0, vec5: 0, vec6: 0, vec7: 0, vec8: 0,
  emoText: '',
  emoRandom: false,
  maxTextTokensPerSegment: 120,
  durationFactor: 1,
  doSample: true,
  topP: 0.8,
  topK: 30,
  temperature: 0.8,
  lengthPenalty: 0,
  numBeams: 3,
  repetitionPenalty: 10,
  maxMelTokens: 1500,
}

/** 表单模型（音色 + 语言 + 全部声音参数） */
const model = reactive<{ voice: string; lang: string; params: api.TtsParams }>({
  voice: '',
  lang: 'ZH',
  params: { ...DEFAULT_PARAMS },
})

/** 表单里的参数键 */
type ParamKey = keyof api.TtsParams

/** 参数说明：类型 / 取值范围 / 步长 / 小数位，文案来自 i18n */
interface ParamMeta {
  key: ParamKey
  label: string
  tip: string
  type: 'number' | 'boolean' | 'string'
  min: number
  max: number
  step: number
  decimals: number
}

/**
 * Computation Setting
 * 计算配置
 */

/** 语言下拉项 */
const langOptions = computed(() => [
  { label: '中文 ZH', value: 'ZH' },
  { label: 'English EN', value: 'EN' },
  { label: '日本語 JA', value: 'JA' },
  { label: 'العربية AR', value: 'AR' },
  { label: 'Español ES', value: 'ES' },
])

/** 参数分组：按「情感 / 分句与时长 / 采样与生成」三段展示 */
const paramGroups = computed(() => {
  const meta = (
    key: ParamKey,
    labelKey: string,
    tipKey: string,
    range: [number, number],
    step = 0.01,
    decimals = 2,
    type: ParamMeta['type'] = 'number',
  ): ParamMeta => ({
    key,
    label: t(`agentAdmin.${labelKey}`),
    tip: t(`agentAdmin.${tipKey}`),
    type,
    min: range[0],
    max: range[1],
    step,
    decimals,
  })

  /** 8 个情感维度：标签里带序号，文案复用同一个键 */
  const vecParams = [1, 2, 3, 4, 5, 6, 7, 8].map((index) => ({
    ...meta(`vec${index}` as ParamKey, 'ttsParamVec', 'ttsParamVecTip', [-1, 1], 0.05, 2),
    label: t('agentAdmin.ttsParamVec', { index }),
  }))

  return [
    {
      title: t('agentAdmin.ttsGroupEmotion'),
      params: [
        meta('emoWeight', 'ttsParamEmoWeight', 'ttsParamEmoWeightTip', [0, 1]),
        ...vecParams,
        meta('emoText', 'ttsParamEmoText', 'ttsParamEmoTextTip', [0, 0], 0, 0, 'string'),
        meta('emoRandom', 'ttsParamEmoRandom', 'ttsParamEmoRandomTip', [0, 0], 0, 0, 'boolean'),
      ],
    },
    {
      title: t('agentAdmin.ttsGroupSegment'),
      params: [
        meta('maxTextTokensPerSegment', 'ttsParamMaxTextTokensPerSegment', 'ttsParamMaxTextTokensPerSegmentTip', [20, 500], 1, 0),
        meta('durationFactor', 'ttsParamDurationFactor', 'ttsParamDurationFactorTip', [0.5, 2], 0.05, 2),
      ],
    },
    {
      title: t('agentAdmin.ttsGroupSampling'),
      params: [
        meta('doSample', 'ttsParamDoSample', 'ttsParamDoSampleTip', [0, 0], 0, 0, 'boolean'),
        meta('topP', 'ttsParamTopP', 'ttsParamTopPTip', [0, 1], 0.05, 2),
        meta('topK', 'ttsParamTopK', 'ttsParamTopKTip', [1, 100], 1, 0),
        meta('temperature', 'ttsParamTemperature', 'ttsParamTemperatureTip', [0.01, 5], 0.05, 2),
        meta('lengthPenalty', 'ttsParamLengthPenalty', 'ttsParamLengthPenaltyTip', [-2, 2], 0.1, 2),
        meta('numBeams', 'ttsParamNumBeams', 'ttsParamNumBeamsTip', [1, 10], 1, 0),
        meta('repetitionPenalty', 'ttsParamRepetitionPenalty', 'ttsParamRepetitionPenaltyTip', [0.1, 100], 0.5, 2),
        meta('maxMelTokens', 'ttsParamMaxMelTokens', 'ttsParamMaxMelTokensTip', [50, 3000], 50, 0),
      ],
    },
  ]
})

/** 能不能合成：IndexTTS 可达 + 至少有一个音色 */
const canSynthesize = computed(() => Boolean(status.value?.reachable) && voices.value.length > 0)

/** 采样率（后端没单独返回，这里按「16bit 单声道 wav 的字节数 / 时长」反推） */
const sampleRateText = computed(() => {
  const result = previewResult.value
  if (!result || !result.audioMs) return '—'
  const seconds = result.audioMs / 1000
  if (seconds <= 0) return '—'
  return `${Math.round(result.bytes / 2 / seconds)} Hz`
})

/**
 * Method Setting
 * 方法配置
 */

/** 记一笔「有未保存修改」 */
function markDirty() {
  dirty.value = true
  // 音色 / 语言 / 参数一变，上一次的试听结果就过期了
  previewResult.value = null
}

/** 改一个参数（滑块与数字输入共用） */
function setParam(key: ParamKey, value: number | string | boolean) {
  if (typeof value === 'number' && Number.isNaN(value)) return
  ;(model.params as Record<string, unknown>)[key] = value
  markDirty()
}

/** 参数恢复默认值（音色与语言不动） */
function resetParams() {
  model.params = { ...DEFAULT_PARAMS }
  markDirty()
}

/** 用后端返回的配置填充表单 */
function applyConfig(config: api.TtsConfig | null | undefined) {
  if (!config) return
  model.voice = config.voice || ''
  model.lang = config.lang || 'ZH'
  model.params = { ...DEFAULT_PARAMS, ...(config.params || {}) }
}

/** 字节数格式化 */
function formatBytes(size: number) {
  if (!size || size < 0) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

/** 毫秒格式化：小于 1 秒显示毫秒，否则显示秒（保留一位小数） */
function formatMs(ms: number) {
  if (!ms) return '—'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/**
 * Get Data
 * 获取数据
 */

/** 拉配置 + 音色列表 + 状态（一次把页面要的都取回来） */
async function loadAll() {
  loading.value = true
  statusLoading.value = true

  try {
    const res = await api.getTtsConfig()
    if (res.code === 2000) {
      applyConfig(res.data)
      dirty.value = false
      ready.value = true
    } else {
      MessagePlugin.error(translateServerText(res.message) || t('agentAdmin.ttsLoadFailed'))
    }
  } catch {
    MessagePlugin.error(t('agentAdmin.ttsLoadFailed'))
  }

  try {
    const res = await api.getTtsVoices()
    if (res.code === 2000) {
      voices.value = res.data?.items || []
      voicesDir.value = res.data?.dir || ''
      if (!model.voice && res.data?.current) model.voice = res.data.current
    }
  } catch {
    voices.value = []
  }

  try {
    const res = await api.getTtsStatus()
    if (res.code === 2000) status.value = res.data as api.TtsStatus
  } catch {
    status.value = null
  }

  loading.value = false
  statusLoading.value = false
}

/**
 * Save Config
 * 保存配置
 */
async function handleSave() {
  saving.value = true
  try {
    const res = await api.saveTtsConfig({
      voice: model.voice,
      lang: model.lang,
      params: { ...model.params },
    })
    if (res.code === 2000) {
      // 保存后立刻回读一次：以磁盘上的配置为准（也顺带证明真的落盘了）
      const check = await api.getTtsConfig()
      if (check.code === 2000) applyConfig(check.data)
      dirty.value = false
      MessagePlugin.success(t('agentAdmin.ttsSaveSuccess'))
    } else {
      MessagePlugin.error(translateServerText(res.message) || t('agentAdmin.ttsSaveFailed'))
    }
  } catch {
    MessagePlugin.error(t('agentAdmin.ttsSaveRetry'))
  } finally {
    saving.value = false
  }
}

/**
 * Preview / Audition
 * 试听合成
 */

/** 回收上一个 blob URL，避免内存泄漏 */
function releaseAudio() {
  playing.value = false
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = ''
  }
}

/**
 * 合成并准备播放
 *
 * @param text 试听文本
 * @param voice 试听用的音色（不传用表单里选中的）
 */
async function synthesizeAndPlay(text: string, voice?: string) {
  releaseAudio()
  previewResult.value = null

  const res = await api.previewTts({
    text,
    voice: voice || model.voice,
    lang: model.lang,
    params: { ...model.params },
  })
  if (res.code !== 2000) {
    MessagePlugin.error(translateServerText(res.message) || t('agentAdmin.ttsPreviewFailed'))
    return
  }

  const result = res.data as api.TtsPreviewResult
  // <audio src> 带不上 JWT，必须先换成 blob: URL（见 api.ts 里的说明）
  loadingAudio.value = true
  audioUrl.value = await api.fetchTtsAudioBlobUrl(result.audioUrl)
  loadingAudio.value = false
  previewResult.value = result

  if (!voice) {
    MessagePlugin.success(t('agentAdmin.ttsPreviewDone', { ms: `${result.ms}ms` }))
  }
}

/** 试听区「合成试听」 */
async function handlePreview() {
  if (!previewText.value.trim()) {
    MessagePlugin.warning(t('agentAdmin.ttsPreviewTextRequired'))
    return
  }
  previewing.value = true
  try {
    await synthesizeAndPlay(previewText.value.trim())
  } catch (error: any) {
    loadingAudio.value = false
    MessagePlugin.error(error?.message || t('agentAdmin.ttsPreviewFailed'))
  } finally {
    previewing.value = false
  }
}

/** 音色行上的「试听」：用固定短句 */
async function handleAudition(voice: string) {
  auditionVoice.value = voice
  try {
    await synthesizeAndPlay(t('agentAdmin.ttsAuditionText'), voice)
  } catch (error: any) {
    loadingAudio.value = false
    MessagePlugin.error(error?.message || t('agentAdmin.ttsPreviewFailed'))
  } finally {
    auditionVoice.value = ''
  }
}

// 页面打开时
onMounted(() => {
  previewText.value = t('agentAdmin.ttsAuditionText')
  loadAll()
})

// 离开页面时停掉播放并回收 blob URL
onBeforeUnmount(() => {
  releaseAudio()
})
</script>

<style lang="scss" scoped>@import url("./index.scss");</style>

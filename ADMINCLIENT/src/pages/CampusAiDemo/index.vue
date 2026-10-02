<template>
  <t-card class="container">
    <!-- 工具条：页面标题 + 演示标识 -->
    <template #title>
      <div class="campus-ai__header">
        <span class="campus-ai__title">{{ $t('campusAi.pageTitle') }}</span>
        <t-tag variant="outline" size="small">{{ $t('campusAi.demoTag') }}</t-tag>
        <span class="campus-ai__subtitle">{{ $t('campusAi.pageSubtitle') }}</span>
      </div>
    </template>

    <template #default>
      <!-- 页面自己的块名：既方便样式，也让自动化测试能把它和顶栏的「路由标签」区分开 -->
      <t-tabs v-model="activeTab" class="campus-ai" data-testid="campus-ai-tabs">
        <!-- ── 教师教学 ────────────────────────────── -->
        <t-tab-panel value="teacher" :label="$t('campusAi.tabTeacher')">
          <div class="campus-ai__tab">
            <div class="campus-ai__cards">
              <t-card class="campus-ai__card" :title="$t('campusAi.teacherCardSubmit')">
                <template #default>
                  <div class="campus-ai__card-value">{{ teamSubmitRate }}</div>
                  <div class="campus-ai__card-tip">{{ $t('campusAi.demoTag') }}</div>
                </template>
              </t-card>

              <t-card class="campus-ai__card" :title="$t('campusAi.teacherCardScore')">
                <template #default>
                  <div class="campus-ai__card-value">{{ teacherAvgScore }}</div>
                  <div class="campus-ai__card-tip">{{ teacherPassRate }}</div>
                </template>
              </t-card>

              <t-card class="campus-ai__card" :title="$t('campusAi.teacherCardErrors')">
                <template #default>
                  <ul class="campus-ai__list">
                    <li v-for="item in teacherErrorRows" :key="item.key" class="campus-ai__list-item">
                      {{ item.text }}
                    </li>
                  </ul>
                </template>
              </t-card>
            </div>

            <t-card class="campus-ai__table" :title="$t('campusAi.teacherTrendTitle')">
              <template #default>
                <v-chart
                  class="campus-ai__chart"
                  data-testid="campus-ai-chart-teacher"
                  :option="teacherTrendOption"
                  autoresize
                />
              </template>
            </t-card>

            <t-card class="campus-ai__table" :title="$t('campusAi.teacherTableTitle')">
              <template #default>
                <t-table
                  size="small"
                  :data="teacherTableData"
                  :columns="teacherColumns"
                  row-key="key"
                  bordered
                  hover
                  table-layout="fixed"
                />
              </template>
            </t-card>
          </div>
        </t-tab-panel>

        <!-- ── 学生学习 ────────────────────────────── -->
        <t-tab-panel value="student" :label="$t('campusAi.tabStudent')">
          <div class="campus-ai__tab">
            <div class="campus-ai__cards">
              <t-card class="campus-ai__card" :title="$t('campusAi.studentCardHours')">
                <template #default>
                  <div class="campus-ai__card-value">{{ studentHoursText }}</div>
                  <div class="campus-ai__card-tip">{{ $t('campusAi.demoTag') }}</div>
                </template>
              </t-card>

              <t-card class="campus-ai__card" :title="$t('campusAi.studentCardMastery')">
                <template #default>
                  <div class="campus-ai__card-value">{{ studentMasteryAvg }}</div>
                  <div class="campus-ai__card-tip">{{ $t('campusAi.colMastery') }}</div>
                </template>
              </t-card>

              <t-card class="campus-ai__card" :title="$t('campusAi.studentCardReview')">
                <template #default>
                  <ul class="campus-ai__list">
                    <li v-for="item in studentReviewRows" :key="item.key" class="campus-ai__list-item">
                      {{ item.text }}
                    </li>
                  </ul>
                </template>
              </t-card>
            </div>

            <t-card class="campus-ai__table" :title="$t('campusAi.studentPieTitle')">
              <template #default>
                <v-chart
                  class="campus-ai__chart"
                  data-testid="campus-ai-chart-student"
                  :option="studentPieOption"
                  autoresize
                />
              </template>
            </t-card>

            <t-card class="campus-ai__table" :title="$t('campusAi.studentTableTitle')">
              <template #default>
                <t-table
                  size="small"
                  :data="studentTableData"
                  :columns="studentColumns"
                  row-key="key"
                  bordered
                  hover
                  table-layout="fixed"
                />
              </template>
            </t-card>
          </div>
        </t-tab-panel>

        <!-- ── 行政办公 ────────────────────────────── -->
        <t-tab-panel value="admin" :label="$t('campusAi.tabAdmin')">
          <div class="campus-ai__tab">
            <div class="campus-ai__cards">
              <t-card class="campus-ai__card" :title="$t('campusAi.adminCardTodo')">
                <template #default>
                  <div class="campus-ai__card-value">{{ adminTodoText }}</div>
                  <div class="campus-ai__card-tip">{{ $t('campusAi.demoTag') }}</div>
                </template>
              </t-card>

              <t-card class="campus-ai__card" :title="$t('campusAi.adminCardDocs')">
                <template #default>
                  <div class="campus-ai__card-value">{{ adminDocsText }}</div>
                  <div class="campus-ai__card-tip">{{ $t('campusAi.demoTag') }}</div>
                </template>
              </t-card>

              <t-card class="campus-ai__card" :title="$t('campusAi.adminCardRooms')">
                <template #default>
                  <ul class="campus-ai__list">
                    <li v-for="item in adminRoomRows" :key="item.key" class="campus-ai__list-item">
                      {{ item.text }}
                    </li>
                  </ul>
                </template>
              </t-card>
            </div>

            <t-card class="campus-ai__table" :title="$t('campusAi.adminBarTitle')">
              <template #default>
                <v-chart
                  class="campus-ai__chart"
                  data-testid="campus-ai-chart-admin"
                  :option="adminBarOption"
                  autoresize
                />
              </template>
            </t-card>

            <t-card class="campus-ai__table" :title="$t('campusAi.adminTableTitle')">
              <template #default>
                <t-table
                  size="small"
                  :data="adminTableData"
                  :columns="adminColumns"
                  row-key="key"
                  bordered
                  hover
                  table-layout="fixed"
                />
              </template>
            </t-card>
          </div>
        </t-tab-panel>
      </t-tabs>

      <!-- AI 助手答疑：纯前端模拟对话，不调任何接口 -->
      <t-card class="campus-ai__chat" data-testid="campus-ai-chat">
        <template #title>
          <div>
            <div class="campus-ai__chat-title">
              <span>{{ $t('campusAi.chatTitle') }}</span>
              <t-tag theme="warning" variant="light" size="small">
                {{ $t('campusAi.chatMockTag') }}
              </t-tag>
            </div>
            <div class="campus-ai__chat-desc">{{ $t('campusAi.chatDesc') }}</div>
          </div>
        </template>

        <template #default>
          <div class="campus-ai__messages">
            <!-- 用户消息靠右，助手消息靠左 -->
            <div
              v-for="(message, index) in messages"
              :key="index"
              class="campus-ai__message"
              :class="`campus-ai__message--${message.role}`"
              data-testid="campus-ai-msg"
            >
              <span class="campus-ai__message-role">{{ roleLabel(message.role) }}</span>
              <div class="campus-ai__bubble" :data-testid="`campus-ai-msg-${message.role}`">
                {{ message.text }}
              </div>
            </div>
          </div>

          <div class="campus-ai__composer">
            <t-input
              v-model="chatInput"
              class="campus-ai__composer-input"
              data-testid="campus-ai-chat-input"
              :placeholder="$t('campusAi.chatPlaceholder')"
              clearable
              @enter="handleSend"
            />
            <t-button data-testid="campus-ai-chat-send" theme="primary" @click="handleSend">
              {{ $t('campusAi.chatSend') }}
            </t-button>
            <t-button data-testid="campus-ai-chat-clear" variant="outline" @click="handleClear">
              {{ $t('campusAi.chatClear') }}
            </t-button>
          </div>
        </template>
      </t-card>
    </template>

    <template #footer>
      <span class="campus-ai__footer">{{ $t('campusAi.pageSubtitle') }}</span>
    </template>
  </t-card>
</template>

<script lang="ts">
export default { name: 'CampusAiPageNew' }
</script>

<script lang="ts" setup>
// 赛题 Demo：本页为「院校 AI 智能辅助」演示页，数据全部为前端 mock，不请求后端。
// 页面 `name` 必须等于后台菜单的 `component_name`（CampusAiPageNew），路由由菜单驱动：
// 前端 addMenuRoutes 用 `path: '/' + component_name` 注册路由。
//
// 为什么带 New 后缀：vue-router 4 的路径匹配默认 `sensitive: false`（见 vue-router.mjs 的
// BASE_PATH_PARSER_OPTIONS），也就是说 /CampusAiPage 与 /CampusAIPage 会被当成同一个路由。
// 本仓库里已经存在一个（未提交的）CampusAIPage，若本页也叫 CampusAiPage，打开链接一定会
// 落到那一页上。为了不动别人的页面、也不动路由文件，这里把组件名取成大小写唯一的名字。
// 详见提交说明与 .build-tmp 的验证报告。
// 1. 第三方依赖
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, tm } = useI18n()

/**
 * Data Setting
 * 数据配置
 */

/** 当前页签 */
const activeTab = ref('teacher')

/** 对话消息（仅前端演示） */
interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

const messages = ref<ChatMessage[]>([{ role: 'assistant', text: t('campusAi.chatWelcome') }])

/** 输入框内容 */
const chatInput = ref('')

/** 已发送的用户消息条数，用于回复取模轮换 */
let replyCursor = 0

/** 模拟回复定时器（组件卸载时必须清掉） */
let chatTimer: ReturnType<typeof setTimeout> | null = null

/** 表格一行（mock 数据的列值都是标量，避免用索引签名） */
interface DemoTableRow {
  key: string
  col1: string
  col2: string
  col3: string
}

/** 表格一列 */
interface DemoTableColumn {
  colKey: string
  title: string
}

/* ── 教师教学 mock ────────────────────────────── */

/** 三个班：展示名走 i18n，rates 是近 7 天作业提交率（%） */
const TEACHER_CLASSES = [
  { key: 'c1', labelKey: 'campusAi.classNameA', color: '--td-brand-color', rates: [72, 75, 78, 80, 79, 84, 82] },
  { key: 'c2', labelKey: 'campusAi.classNameB', color: '--td-success-color', rates: [88, 87, 90, 92, 89, 91, 93] },
  { key: 'c3', labelKey: 'campusAi.classNameC', color: '--td-warning-color', rates: [65, 68, 70, 72, 74, 73, 76] },
]

/** 横轴：近 7 天 */
const DAY_LABEL_KEYS = [
  'campusAi.dayMon',
  'campusAi.dayTue',
  'campusAi.dayWed',
  'campusAi.dayThu',
  'campusAi.dayFri',
  'campusAi.daySat',
  'campusAi.daySun',
]

/** 常见错误 Top3 */
const TEACHER_ERROR_KEYS = [
  'campusAi.errorGeometry',
  'campusAi.errorCloze',
  'campusAi.errorFormula',
]

/** 教师表格列键：班级 / 提交率 / 平均分 */
const TEACHER_TABLE_KEYS = ['campusAi.colClass', 'campusAi.colSubmitRate', 'campusAi.colAvgScore']

/* ── 学生学习 mock ────────────────────────────── */

/** 知识点：展示名 + 掌握度（%）+ 对应建议 */
const KNOWLEDGE_ITEMS = [
  { key: 'k1', labelKey: 'campusAi.knowledgeDerivative', adviceKey: 'campusAi.adviceDerivative', mastery: 92 },
  { key: 'k2', labelKey: 'campusAi.knowledgeCloze', adviceKey: 'campusAi.adviceCloze', mastery: 76 },
  { key: 'k3', labelKey: 'campusAi.knowledgeElectro', adviceKey: 'campusAi.adviceElectro', mastery: 58 },
  { key: 'k4', labelKey: 'campusAi.knowledgeReading', adviceKey: 'campusAi.adviceReading', mastery: 44 },
]

/** 掌握度分档（从低到高，与 buckets 下标一一对应） */
const MASTERY_BUCKET_KEYS = [
  'campusAi.masteryBucketWeak',
  'campusAi.masteryBucketLow',
  'campusAi.masteryBucketMid',
  'campusAi.masteryBucketHigh',
]

/** 待复习清单 */
const REVIEW_KEYS = [
  'campusAi.reviewDerivative',
  'campusAi.reviewElectro',
  'campusAi.reviewReading',
]

/* ── 行政办公 mock ────────────────────────────── */

/** 部门事务量：部门名 + 事务量 + 积压 */
const DEPT_TASKS = [
  { key: 'd1', labelKey: 'campusAi.deptAcademic', taskCount: 42, backlog: 5 },
  { key: 'd2', labelKey: 'campusAi.deptStudent', taskCount: 31, backlog: 3 },
  { key: 'd3', labelKey: 'campusAi.deptLogistics', taskCount: 24, backlog: 2 },
  { key: 'd4', labelKey: 'campusAi.deptTeaching', taskCount: 18, backlog: 7 },
]

/** 场馆与教室占用 */
const ROOM_KEYS = [
  'campusAi.roomLecture',
  'campusAi.roomLab',
  'campusAi.roomGym',
]

/**
 * Computed Setting
 * 计算配置
 */

/* ── 教师教学 ────────────────────────────── */

/** 三个班的提交率折线图 */
const teacherTrendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 0, data: TEACHER_CLASSES.map((item) => t(item.labelKey)) },
  grid: { left: 8, right: 16, top: 36, bottom: 4, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: DAY_LABEL_KEYS.map((key) => t(key)),
  },
  yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
  series: TEACHER_CLASSES.map((item) => ({
    name: t(item.labelKey),
    type: 'line',
    smooth: true,
    showSymbol: false,
    areaStyle: { opacity: 0.12 },
    itemStyle: { color: getCssVar(item.color, '#0052d9') },
    data: item.rates,
  })),
}))

/** 班级作业提交率概览 */
const teamSubmitRate = computed(() => '83.4%')

/** 平均分与及格率 */
const teacherAvgScore = computed(() => '78.6')
const teacherPassRate = computed(() => '83.4%')

/** 常见错误 Top3 */
const teacherErrorRows = computed(() =>
  TEACHER_ERROR_KEYS.map((key, index) => ({
    key: `err-${index}`,
    text: `${index + 1}. ${t(key)}`,
  })),
)

/** 教师表格列 */
const teacherColumns = computed<DemoTableColumn[]>(() =>
  TEACHER_TABLE_KEYS.map((key) => ({ colKey: key, title: t(key) })),
)

/** 教师表格数据 */
const teacherTableData = computed<DemoTableRow[]>(() =>
  TEACHER_CLASSES.map((item, index) => ({
    key: item.key,
    col1: t(item.labelKey),
    col2: `${item.rates[item.rates.length - 1]}%`,
    col3: (74 + index * 3.6).toFixed(1),
  })),
)

/* ── 学生学习 ────────────────────────────── */

/** 知识点掌握度分布饼图 */
const studentPieOption = computed(() => {
  const buckets = [0, 0, 0, 0]
  KNOWLEDGE_ITEMS.forEach((item) => {
    const index = item.mastery >= 90 ? 3 : item.mastery >= 75 ? 2 : item.mastery >= 60 ? 1 : 0
    buckets[index] = (buckets[index] ?? 0) + 1
  })

  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        label: { formatter: '{b}: {c}' },
        data: MASTERY_BUCKET_KEYS.map((key, index) => ({
          name: t(key),
          value: buckets[index],
        })),
      },
    ],
  }
})

/** 本周学习时长 */
const studentHoursText = computed(() => `12.5 ${t('campusAi.unitHours')}`)

/** 平均掌握度 */
const studentMasteryAvg = computed(() => {
  const total = KNOWLEDGE_ITEMS.reduce((sum, item) => sum + item.mastery, 0)
  return `${Math.round(total / KNOWLEDGE_ITEMS.length)}%`
})

/** 待复习清单 */
const studentReviewRows = computed(() =>
  REVIEW_KEYS.map((key, index) => ({ key: `rev-${index}`, text: t(key) })),
)

/** 学生表格列 */
const studentColumns = computed<DemoTableColumn[]>(() => [
  { colKey: 'col1', title: t('campusAi.colKnowledge') },
  { colKey: 'col2', title: t('campusAi.colMastery') },
  { colKey: 'col3', title: t('campusAi.colAdvice') },
])

/** 学生表格数据 */
const studentTableData = computed<DemoTableRow[]>(() =>
  KNOWLEDGE_ITEMS.map((item) => ({
    key: item.key,
    col1: t(item.labelKey),
    col2: `${item.mastery}%`,
    col3: t(item.adviceKey),
  })),
)

/* ── 行政办公 ────────────────────────────── */

/** 各部门本周事务量柱状图 */
const adminBarOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: {
    top: 0,
    data: [t('campusAi.colTaskCount'), t('campusAi.colBacklog')],
  },
  grid: { left: 8, right: 16, top: 36, bottom: 4, containLabel: true },
  xAxis: { type: 'category', data: DEPT_TASKS.map((item) => t(item.labelKey)) },
  yAxis: { type: 'value', minInterval: 1 },
  series: [
    {
      name: t('campusAi.colTaskCount'),
      type: 'bar',
      barMaxWidth: 26,
      itemStyle: { color: getCssVar('--td-brand-color', '#0052d9') },
      data: DEPT_TASKS.map((item) => item.taskCount),
    },
    {
      name: t('campusAi.colBacklog'),
      type: 'bar',
      barMaxWidth: 26,
      itemStyle: { color: getCssVar('--td-warning-color', '#ed7b2f') },
      data: DEPT_TASKS.map((item) => item.backlog),
    },
  ],
}))

/** 待办事项 */
const adminTodoText = computed(() => `9 ${t('campusAi.unitCount')}`)

/** 本周公文流转 */
const adminDocsText = computed(() => `27 ${t('campusAi.unitCount')}`)

/** 场馆与教室占用清单 */
const adminRoomRows = computed(() =>
  ROOM_KEYS.map((key, index) => ({ key: `room-${index}`, text: t(key) })),
)

/** 行政表格列 */
const adminColumns = computed<DemoTableColumn[]>(() => [
  { colKey: 'col1', title: t('campusAi.colDept') },
  { colKey: 'col2', title: t('campusAi.colTaskCount') },
  { colKey: 'col3', title: t('campusAi.colBacklog') },
])

/** 行政表格数据 */
const adminTableData = computed<DemoTableRow[]>(() =>
  DEPT_TASKS.map((item) => ({
    key: item.key,
    col1: t(item.labelKey),
    col2: String(item.taskCount),
    col3: String(item.backlog),
  })),
)

/**
 * Method Setting
 * 方法配置
 */

/** 读取主题 CSS 变量，供 ECharts 配色使用 */
function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** 消息角色展示名 */
function roleLabel(role: 'user' | 'assistant'): string {
  return role === 'user' ? t('campusAi.chatUser') : t('campusAi.chatAssistant')
}

/** 取 mock 回复数组（i18n 里是字符串数组，vue-i18n 缺键时会回落成键名，这里只保留字符串项） */
function getMockReplies(): string[] {
  const list = tm('campusAi.aiReplies')
  if (!Array.isArray(list)) return []
  return list.filter((item): item is string => typeof item === 'string')
}

/** 清掉未触发的模拟回复定时器 */
function clearChatTimer() {
  if (chatTimer !== null) {
    clearTimeout(chatTimer)
    chatTimer = null
  }
}

/** 发送：push 用户输入，约 600ms 后 push 一条本地模拟回复 */
function handleSend() {
  const text = chatInput.value.trim()
  if (!text) return

  messages.value.push({ role: 'user', text })
  chatInput.value = ''

  const replies = getMockReplies()
  const reply = replies.length ? String(replies[replyCursor % replies.length] ?? '') : ''
  replyCursor += 1

  clearChatTimer()
  chatTimer = setTimeout(() => {
    messages.value.push({ role: 'assistant', text: reply })
    chatTimer = null
  }, 600)
}

/** 清空对话：回到一条欢迎语 */
function handleClear() {
  clearChatTimer()
  replyCursor = 0
  messages.value = [{ role: 'assistant', text: t('campusAi.chatWelcome') }]
}

onBeforeUnmount(() => {
  clearChatTimer()
})
</script>

<style lang="scss" scoped>@import url("./index.scss");</style>

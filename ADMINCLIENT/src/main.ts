import { createApp } from 'vue'
import { createPinia } from 'pinia'
import TDesign from 'tdesign-vue-next'
import tFocusInput from './components/SystemsComponents/TFocusInput/t-focus-input.vue'
import tFocusNumberInput from './components/SystemsComponents/TFocusNumberInput/t-focus-number-input.vue'

import App from './App.vue'
import router from './router'
import i18n, { getInitialLocale } from './locales'

// @ts-ignore 忽略模块类型检查，因原JS文件未提供类型声明
import { registerDirectives } from './utils/directives/index.js'; // 导入指令注册函数

// TDesign
import 'tdesign-vue-next/es/style/index.css'

// 全局样式
import './assets/styles/main.css'

// ====================
// ECharts
// ====================
import ECharts from 'vue-echarts'

import { use } from 'echarts/core'

import {
  CanvasRenderer
} from 'echarts/renderers'

import {
  LineChart,
  PieChart,
  BarChart
} from 'echarts/charts'

import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent
} from 'echarts/components'

use([
  CanvasRenderer,

  LineChart,
  PieChart,
  BarChart,

  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
])

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(TDesign)
app.use(i18n)

// 设置文档语言，便于浏览器/无障碍识别
document.documentElement.lang = getInitialLocale()

// 注册全局组件
app.component('v-chart', ECharts)
app.component('TFocusInput', tFocusInput)
app.component('TFocusNumberInput', tFocusNumberInput)
registerDirectives(app);

app.mount('#app')

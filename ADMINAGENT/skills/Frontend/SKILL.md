# 前端开发规范 · ADMINCLIENT

> 本文件是 ADMINCLIENT 的唯一前端规范，由现有代码里的实际约定提炼而成。
> 新增页面、组件、接口、样式一律照此执行；与本文冲突的写法都视为不合规。

## 一、技术栈

Vue 3.5（`<script setup lang="ts">`）+ Vite 7 + TypeScript + TDesign Vue Next 1.17 +
Pinia + vue-router 4 + vue-i18n 11 + ECharts 6（`vue-echarts`）。
包管理器固定 **pnpm 10**（版本写在 `ADMINSERVER/package.json` 之外的各自工程里用同一个）。

## 二、目录结构

| 位置 | 约定 |
| --- | --- |
| `src/pages/<业务组>/<页面>/index.vue` | 页面主体，文件名必须是 `index.vue` |
| `src/pages/<业务组>/<页面>/api.ts` | 该页面专用接口，一页一文件 |
| `src/pages/<业务组>/<页面>/index.scss` | 页面样式（较大时独立成文件） |
| `src/pages/<业务组>/<页面>/components/<子组件>/<子组件>.vue` | 页面内弹窗/子页面 |
| `src/components/<组件名>/index.vue` | 全局组件（`unplugin-vue-components` 自动注册，模板里写 kebab-case） |
| `src/utils/<分类>/<工具>.ts` | 纯函数 / 组合式函数 |
| `src/locales/zh-CN.ts`、`en-US.ts` | 文案，两个文件必须同步新增 |

**路由由后端菜单驱动**，不要手写路由：

- `component_address` = `/src/pages/.../index.vue`（对应 `import.meta.glob('@/**/*.vue')` 的 key）
- `component_name` = 页面 `name`，也是 KeepAlive 的 include 依据，三者必须一致
- 菜单是数据库数据，新建页面后要在「菜单管理」里登记（或用 `QuickStart/create_system_ops_menu.js` 这类脚本调接口创建）

## 三、页面骨架

### 3.1 列表页（标准 CRUD）

```vue
<template>
  <t-card class="container">
    <!-- 工具条：搜索条件 + 主操作按钮 -->
    <template #title>
      <t-space>
        <t-input
          v-model="searchForm.ep.keyword"
          :placeholder="$t('xxx.searchPlaceholder')"
          clearable
          style="width: 180px;"
        />
        <t-button theme="success" :loading="searchLoading" @click="handleSearch">
          {{ $t('common.search') }}
          <template #icon><SearchIcon /></template>
        </t-button>
        <t-button @click="addVisible = true">
          {{ $t('common.add') }}
          <template #icon><AddIcon /></template>
        </t-button>
      </t-space>
    </template>

    <!-- 内容：表格 -->
    <template #default>
      <t-table
        size="small"
        :data="listData.data"
        :columns="tableColumns"
        :loading="listLoading"
        row-key="id"
        bordered
        hover
        resizable
        :maxHeight="575"
        tableLayout="fixed"
        drag-sort="col"
        @drag-sort="onDragSort"
        @column-resize-change="onColumnResizeEnd"
        @change="changeTable"
      >
        <template #actions="{ row }">
          <t-space align="center" :size="2" separator="|">
            <t-button size="small" variant="text" theme="primary" @click="handleEdit(row)">
              {{ $t('common.edit') }}
            </t-button>
            <t-button size="small" variant="text" theme="danger" @click="handleDelete(row)">
              {{ $t('common.delete') }}
            </t-button>
          </t-space>
        </template>
      </t-table>
    </template>

    <!-- 右侧：筛选器等附加工具（可省略） -->
    <template #actions>
      <t-space align="center">
        <SearchFilter v-model="searchForm.cdList" :filter-fields="filterFields"
          @confirm="onOrderFilterConfirm" @reset="onOrderFilterReset" />
      </t-space>
    </template>

    <!-- 底部：分页 -->
    <template #footer>
      <t-pagination
        v-model="searchForm.paging.pageNumber"
        v-model:pageSize="searchForm.paging.pageSize"
        style="width: 100%;"
        :total="listData.total"
        :page-size-options="[5, 10, 20, 50, 100]"
        show-jumper
        @change="handlePageChange"
      />
    </template>
  </t-card>

  <!-- Sub Pages -->
  <UpdateXxx v-model:visible="updateVisible" :id="selectId" @resetXxxList="getListData" />
  <AddXxx v-model:visible="addVisible" @resetXxxList="getListData" />
</template>
```

要点：

- 页面根节点是 `<t-card class="container">`，用插槽分区：`#title` 工具条 / `#default` 内容 / `#actions` 附加工具 / `#footer` 分页。
- 子页面（弹窗）放在 `t-card` 之后，统一用 `v-model:visible` 控制显隐，用 `@resetXxxList` 通知父页面刷新。
- 表格固定带 `bordered hover resizable tableLayout="fixed"`，`size="small"`，`maxHeight` 取 575 左右。
- 操作列用 `t-space separator="|"` + `variant="text"` 按钮，删除用 `theme="danger"`。

### 3.2 看板页（BI）

看板页不套 `t-table`，用「指标卡 + 图表」组合，同样以 `<t-card class="container">` 为根：

- 顶部一行 `t-row` / `t-col`（或 flex + gap）放 3~5 个**指标卡**：`t-card` + 指标名 + 大号数值 + 辅助说明（单位/占比/状态标签）。
- 中部放**趋势图**：`<v-chart class="xxx__chart" :option="trendOption" autoresize />`。
- 底部放**分布图**（饼图/条形图）与明细列表。
- 数值格式化函数写在页面内（`formatBytes`、`formatDuration`、`formatPercent`），不要散落在模板里。

### 3.3 页面 `name` 与 KeepAlive

```vue
<script lang="ts">
export default { name: 'XxxPage' }
</script>
```

`name` 必须等于后台菜单的 `component_name`；需要缓存的页面在菜单里把「是否缓存」设为是。

## 四、script 组织顺序

严格按下面顺序书写，分节注释用**中英双行**（沿用现有代码风格）：

```ts
<script lang="ts" setup>
// 1. 第三方依赖
import { SearchIcon, AddIcon } from 'tdesign-icons-vue-next';
import { ref, computed, onMounted, type Ref } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
// 2. 工程内工具
import { useColumnConfig } from '@/utils/common/useColumnConfig'
import { useI18n } from 'vue-i18n'
// 3. 接口
import * as api from "./api"

const { t } = useI18n()
const { rawColumns, displayColumns: tableColumns, setColumns, toSubmitColumns, restoreRawTitles } = useColumnConfig()

// Sub Pages
import UpdateXxx from "./components/updateXxx/updateXxx.vue"

// 页面打开时
onMounted(() => {
  getListData()
})

/**
 * Data Setting
 * 数据配置
 */
const searchForm: Ref<{
  ep: { keyword: string },
  paging: { pageNumber: number; pageSize: number; sortDirection?: string; sortField?: string },
  cdList: any[]
}> = ref({ ep: { keyword: '' }, paging: { pageNumber: 1, pageSize: 10 }, cdList: [] })

const listData = ref({ data: [], total: 0 })
const listLoading = ref(false)

/**
 * Method Setting
 * 方法配置
 */

/**
 * Get List
 * 获取列表
 */
async function getListData() { /* ... */ }
</script>
```

## 五、接口层 `api.ts`

```ts
import requestApi from "@/utils/request/request";

/** 获取列表 */
export function getXxxList(data: any) {
  return requestApi({
    url: '/hippoadmin/xxx/list',
    method: 'get',
    params: data
  });
}
```

- 一页一个 `api.ts`，不要跨页面复用；函数名用「动词 + 资源」，每个函数写一行 `/** 中文说明 */`。
- 统一返回 `{ code, message, data }`；**成功码是 `2000`**，业务错误是 `4000/4001/4003` 等（拦截器已统一提示）。
- 页面里写 `if (res.code === 2000) { ... } else { MessagePlugin.error(res.message ?? t('...')) }`。
- 后端列表接口返回 `{ total, data }`，被包在 `res.data` 里（`res.data.data` 是数组）。
- 分页/搜索参数统一是 `{ ep, paging, cdList }` 结构。

## 六、表格规范

- 列配置来自后端「菜单配置」（`menu_status.column_config`），用 `useColumnConfig()` 组合式函数加载与回写，不要在前端硬编码列。
- 加载：`setColumns(res.data.column_config, () => paging.pageNumber, () => paging.pageSize)`，序号列由组合式函数注入。
- 保存前用 `toSubmitColumns(columns)` 还原中文标题、去掉 `cell` 运行时字段。
- 拖拽改列宽/列顺序后调用 `setMenuStatus(menuStatusId, toSubmitColumns(columns))` 回写。
- 分页尺寸选项固定 `[5, 10, 20, 50, 100]`，带 `show-jumper`。

## 七、弹窗与二次确认

删除等破坏性操作必须二次确认，并复用 `common.*` 文案：

```ts
const dialog = DialogPlugin.confirm({
  header: t('common.deleteConfirmTitle'),
  body: t('xxx.deleteBody', { name: row.name }),
  theme: 'danger',
  confirmBtn: { content: t('common.confirm') },
  onConfirm: async () => {
    dialog.update({ confirmBtn: { loading: true, content: t('common.deleting'), theme: 'danger' } })
    try {
      const res = await api.deleteXxx(row.id)
      if (res.code === 2000) {
        MessagePlugin.success(t('common.deleteSuccess'))
        getListData()
      } else {
        MessagePlugin.error(res.message ?? t('common.deleteFailed'))
      }
    } catch {
      MessagePlugin.error(t('common.deleteRetry'))
    } finally {
      dialog.hide()
    }
  },
})
```

轻提示统一用 `MessagePlugin.success / error / warning / info`；新增、保存成功提示优先复用 `common.saveSuccess`。

## 八、i18n

- 文案全部走 i18n，**禁止在模板里写死中文**。
- 按功能分组：`common.*` / `header.*` / `<功能名>.*`，中英文两个文件同步维护。
- 可复用键：`common.confirm, cancel, save, reset, search, add, edit, delete, update, export, operation, index, remark, success, failed, loading, all, none, yes, no, enabled, disabled, back, submit, required, selectPlaceholder, inputPlaceholder, keywordPlaceholder, noData, deleteConfirmTitle, deleteConfirmBody, deleteSuccess, deleting, deleteFailed, deleteRetry, saveSuccess, saveFailed, saveRetry, updateSuccess`。
- 插值用 `{name}` 形式：`t('xxx.deleteBody', { name: row.name })`。
- 新增键必须同时加到 `zh-CN.ts` 与 `en-US.ts`。

## 九、样式

- 组件样式一律 `<style scoped>`；文件较大时用独立 `index.scss` 并在组件里
  `<style lang="scss" scoped>@import url("./index.scss");</style>`。
- 类名用 BEM：`block__element--modifier`，块名与页面/组件同名，例如
  `.system-ops__panel`、`.system-ops__value--default`。
- 颜色、圆角、间距优先用 TDesign 变量：`var(--td-text-color-primary)`、
  `var(--td-text-color-secondary)`、`var(--td-text-color-placeholder)`、
  `var(--td-bg-color-container)`、`var(--td-bg-color-secondarycontainer)`、
  `var(--td-component-stroke)`、`var(--td-brand-color)`、`var(--td-radius-default)`。
- **字号必须支持全局缩放**：写成 `font-size: calc(13px * var(--app-font-scale, 1));`
  （图标字形除外，图标保持固定 px）。新增写死 px 的字号会被视为不合规。
- 布局高度沿用现有 100vh 体系：外层 `100vh`、内容区 `calc(100vh - 125px)` 内滚动；
  页面根元素不要自己写 `100vh`。
- 图表容器必须给固定高度并加 `autoresize`。

## 十、图标

- 图标统一来自 `tdesign-icons-vue-next`，按需具名导入（如 `import { SearchIcon } from 'tdesign-icons-vue-next'`）。
- 菜单图标必须用 `getMenuIconComponent(menu_icon)`（见 `src/utils/menuIcon.ts`），
  不要直接写 `manifest.find(...).icon`，空图标会直接抛错。

## 十一、全局主题能力（不要绕开）

| 能力 | 存储 key | CSS 变量 | 说明 |
| --- | --- | --- | --- |
| 主题色 | `theme-color` | `--td-brand-color-1..10` | `utils/theme.ts` 生成 10 阶色板 |
| 明暗模式 | `theme-mode` | `theme-mode` 属性 | 切换时用 `switchThemeWithCurtain` 转场 |
| 页面亮度 | `theme-brightness` | `--app-brightness-filter` | 100% 时不设置 filter |
| 字号缩放 | `app-font-scale` | `--app-font-scale` | 所有字号都乘它 |

新页面只要是文本字号，就必须使用 `var(--app-font-scale, 1)`，否则用户调字号时会出现大小不一。

## 十二、ECharts 使用规范

`main.ts` 已全局注册 `<v-chart>`，且**只注册了**这些能力：

- 图表：`LineChart`、`PieChart`、`BarChart`
- 组件：`GridComponent`、`TooltipComponent`、`LegendComponent`、`TitleComponent`、`DatasetComponent`
- 渲染器：`CanvasRenderer`

新增其他图表类型（Gauge、Radar、Map…）必须先在 `main.ts` 的 `use([...])` 里补注册，否则运行时报错。

用法：

```vue
<v-chart class="xxx__chart" :option="trendOption" autoresize />
```

配色优先取品牌色变量：`getComputedStyle(document.documentElement).getPropertyValue('--td-brand-color')`。

## 十三、注释与命名

- 注释用中文；分节标题用中英双行（`/** Data Setting / 数据配置 */`）。
- 函数上方写 JSDoc：一句中文说明 + 需要时补 `@param`。
- 变量/函数用驼峰；接口函数用动词开头；布尔用 `is/has/can` 前缀。
- 不要在模板里塞复杂表达式，抽成 `computed` 或函数。

## 十四、提交前自检清单

- [ ] 页面 `name` = 菜单 `component_name`，`component_address` = `/src/pages/.../index.vue`
- [ ] 文案已同时加到 `zh-CN.ts` 与 `en-US.ts`，模板里没有中文字面量
- [ ] 字号全部用 `calc(Npx * var(--app-font-scale, 1))`
- [ ] 类名符合 BEM，颜色用 `--td-*` 变量
- [ ] 破坏性操作有 `DialogPlugin.confirm` 二次确认
- [ ] 接口写在同目录 `api.ts`，判断 `res.code === 2000`
- [ ] 图表类型已在 `main.ts` 注册
- [ ] **import 路径大小写与磁盘一致**（Linux/CI 区分大小写）
- [ ] `pnpm run build` / `npx vue-tsc --noEmit` 无新增错误
- [ ] 提交信息形如 `feat(scope): 中文说明`

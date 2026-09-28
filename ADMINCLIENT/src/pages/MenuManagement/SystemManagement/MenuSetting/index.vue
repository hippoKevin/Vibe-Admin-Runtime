<template>
    <t-card class="container">
      <template #title>
        <t-space>
          <t-input
            :placeholder="$t('menuSetting.menuNamePlaceholder')"
            v-model="searchForm.ep.menu_name"
            clearable
            style="width: 180px;"
          />
          <t-button theme="success" @click="handleSearch" :loading="searchLoading">
            {{ $t('common.search') }}
            <template #icon><SearchIcon /></template>
          </t-button>
          <!-- 新增按钮 -->
        <t-button @click="addVisible = true">
          {{ $t('common.add') }}
          <template #icon><AddIcon /></template>
        </t-button>
        </t-space>
      </template>
  
      <template #default>
        <t-table
          :data="menuStatusList.data"
          :columns="tableColumns"
          bordered
          hover
          resizable
          row-key="menu_id"
          :loading="tableLoading"
          :maxHeight="675"
          tableLayout="fixed"
          size="small"
        >
          <!-- 列模板预览 -->
          <template #column_config="{ row }">
            <t-space breakLine>
              <t-tag
                v-for="col in row.column_config"
                :key="col.colKey"
                theme="primary"
                size="middle"
              >
                {{ translateServerText(col.title) }}
              </t-tag>
            </t-space>
          </template>
   
          <!-- 操作列 -->
          <template #actions="{ row }">
            <t-space align="center" :size="2" separator="|">
              <t-button size="small" variant="text" theme="primary" @click="handleModify(row)">
                {{ $t('common.edit') }}
              </t-button>
              <t-button size="small" variant="text" theme="danger" @click="handleDelete(row)">
                {{ $t('common.delete') }}
              </t-button>
            </t-space>
          </template>
        </t-table>
      </template>
  
      <template #footer>
        <t-pagination
          v-model="searchForm.paging.pageNumber"
          v-model:pageSize="searchForm.paging.pageSize"
          style="width: 100%;"
          :total="menuStatusList.total"
          :page-size-options="[5, 10, 20, 50, 100]"
          @change="handlePageChange"
          show-jumper
        />
      </template>
    </t-card>
  
    <!-- 修改列模板弹窗 -->
    <t-dialog placement="center" 
      v-model:visible="modifyVisible"
      :header="$t('menuSetting.modifyTitle')"
      :confirm-btn="{ content: $t('common.save'), loading: saveLoading }"
      @confirm="handleSaveModify"
      @close="resetModifyState"
      width="1200px"
    >
  <div class="dialog-body">
    <div class="column-editor">
    <div style="margin-bottom: 12px;">
      <t-button @click="handleAddColumn">
        {{ $t('menuSetting.addColumn') }}
        <template #icon><AddIcon /></template>
      </t-button>
    </div>

    <t-table
      :data="editColumns"
      :columns="editTableColumns"
      bordered
      row-key="colKey"
      tableLayout="auto"
      :maxHeight="675"
      drag-sort="row-handler"
      @drag-sort="handleDragSort"
    >

    <template #drag="{ row }">
      <span
        style="cursor: grab; color: var(--td-text-color-placeholder); font-size: 16px;"
        :style="{ cursor: row.colKey === 'index' || row.colKey === 'actions' || row.fixed ? 'not-allowed' : 'grab' }"
      >
        ☰
      </span>
    </template>

      <!-- 操作名称 / title -->
      <template #title="{ row, rowIndex }">
        <t-input
          v-model="editColumns[rowIndex].title"
          :disabled="row.colKey === 'index' || row.colKey === 'actions'"
          :placeholder="$t('menuSetting.columnTitlePlaceholder')"
        />
      </template>

      <!-- colKey -->
      <template #field="{ row, rowIndex }">
        <t-input
          v-model="editColumns[rowIndex].colKeyInput"
          :disabled="row.colKey === 'index' || row.colKey === 'actions'"
          :placeholder="$t('menuSetting.fieldNamePlaceholder')"
        />
      </template>

      <!-- align -->
      <template #align="{ row, rowIndex }">
        <t-select
          v-model="editColumns[rowIndex].align"
          style="width: 90px;"
        >
          <t-option value="left"   :label="$t('menuSetting.alignLeft')" />
          <t-option value="center" :label="$t('menuSetting.alignCenter')" />
          <t-option value="right"  :label="$t('menuSetting.alignRight')" />
        </t-select>
      </template>

      <!-- fixed -->
      <template #fixed="{ row, rowIndex }">
        <t-select
          v-model="editColumns[rowIndex].fixed"
          style="width: 90px;"
          clearable
          :placeholder="$t('common.none')"
        >
          <t-option v-if="row.colKey !== 'actions'" value="left"  :label="$t('menuSetting.fixedLeft')" />
          <t-option v-if="row.colKey !== 'index'" value="right" :label="$t('menuSetting.fixedRight')" />
        </t-select>
      </template>

      <!-- width -->
      <template #width="{ row, rowIndex }">
        <t-input-number
          v-model="editColumns[rowIndex].width"
          :min="50"
          :max="600"
        />
      </template>

      <!-- 是否显示 -->
      <template #visible="{ row, rowIndex }">
        <t-switch
          v-model="editColumns[rowIndex].visible" 
        />
      </template>

      <!-- 是否显示 -->
      <template #sorter="{ row, rowIndex }">
        <t-switch
          v-model="editColumns[rowIndex].sorter" 
        />
      </template>

      <!-- 操作列 -->
      <template #actions="{ row, rowIndex }">
        
        <t-button
           size="small"
          variant="text"
          theme="danger"
          :disabled="row.colKey === 'index' || row.colKey === 'actions'"
          @click="handleRemoveColumn(rowIndex)"
        >
          {{ $t('common.delete') }}
        </t-button>
      </template>
    </t-table>
  </div>
  </div>
</t-dialog>

    <!-- 新增列模板弹窗 -->
    <t-dialog placement="center" 
    v-model:visible="addVisible"
    :header="$t('menuSetting.addTitle')"
    width="600px"
    :confirm-btn="{ content: $t('common.save'), loading: addLoading }"
    @confirm="handleSaveAdd"
    @close="resetAddState"
  >
    <div class="dialog-body">
      <t-form label-width="90px" style="margin-bottom: 16px;">
      <t-form-item :label="$t('menuSetting.selectMenu')">
        <t-tree-select
          v-model="addMenuId"
          :data="menuOptions"
          :keys="{ value: 'menu_id', label: 'label', children: 'children'}"
          :placeholder="$t('menuSetting.selectMenuPlaceholder')"
          clearable
          filterable
          style="width: 100%"
        />
      </t-form-item>
    </t-form>
    <t-alert theme="info" :message="$t('menuSetting.addAlert')" />
    </div>

  </t-dialog>
  </template>
  
  <script lang="ts">
  export default { name: 'MenuSetting' }
  </script>
  
  <script setup lang="ts">
  import { SearchIcon,AddIcon } from 'tdesign-icons-vue-next'
  import { ref, computed, onMounted, type Ref, watch } from 'vue'
  import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
  import type { ColumnConfig } from '@/entities/other/menu_status.entities'
  import { useI18n } from 'vue-i18n'
  import { translateServerText } from '@/locales'
  import * as api from './api'

  const { t } = useI18n()
  
  // ==================== 类型 ====================
  interface MenuStatusRow {
    menu_status_id: number
    menu_id: number
    menu_name: string        // 关联查询带出的菜单名
    column_config: ColumnConfig[]
  }
  
  // ==================== 生命周期 ====================
  onMounted(() => {
    loadList()
  })
  
  // ==================== 搜索 & 列表 ====================
  const searchForm: Ref<{
    ep: { menu_name: string }
    paging: { pageNumber: number; pageSize: number }
  }> = ref({
    ep: { menu_name: '' },
    paging: { pageNumber: 1, pageSize: 10 },
  })
  
  const searchLoading = ref(false)
  const tableLoading = ref(false)
  const menuStatusList = ref<{ data: MenuStatusRow[]; total: number }>({ data: [], total: 0 })
  
  // 加载列模板菜单
  async function loadList() {
    tableLoading.value = true
    try {
      const res = await api.getMenuStatusList(searchForm.value)
      if (res.code === 2000) {
        menuStatusList.value.data = res.data.data
        menuStatusList.value.total = res.data.total
      }
    } finally {
      tableLoading.value = false
    }
  }

  // 搜索
  
  async function handleSearch() {
    searchLoading.value = true
    searchForm.value.paging.pageNumber = 1
    try {
      await loadList()
    } finally {
      searchLoading.value = false
    }
  }
  
  function handlePageChange(pageInfo: any) {
    searchForm.value.paging.pageNumber = pageInfo.current
    searchForm.value.paging.pageSize = pageInfo.pageSize
    loadList()
  }
  
  // ==================== 外层表格列 ====================
  const tableColumns = computed(() => [
    {
      title: t('menuSetting.colIndex'),
      colKey: 'index',
      width: 75,
      align: 'center',
      fixed: 'left',
      cell: (h: any, { rowIndex }: any) => h('span', {}, (searchForm.value.paging.pageNumber - 1) * searchForm.value.paging.pageSize + rowIndex + 1),
    },
    { title: t('menuSetting.colName'),   colKey: 'menu_name',     align: 'center', width: 100, fixed: 'left' },
    { title: t('menuSetting.colTemplate'), colKey: 'column_config',  align: 'left',   width: 520 },
    { title: t('common.operation'),       colKey: 'actions',        align: 'center', width: 80, fixed: 'right' },
  ])
  
  // ==================== 修改列模板 ====================

  // 在 editColumns 定义之前添加
const DEFAULT_COLUMN: ColumnConfig & { visible: boolean } = {
  colKeyInput: '',
  colKey: '',
  title: '',
  width: 120,
  align: 'center',
  fixed: undefined,
  visible: true,
  // 确保包含 entities 中定义的所有必填字段
  displayIndex: 0,
}

// 弹窗内嵌表格的列定义
const editTableColumns = computed(() => [
  { title: '',         colKey: 'drag',    align: 'center', width: 46  },
  { title: t('menuSetting.editColTitle'),   colKey: 'title',   align: 'center', width: 120, },
  { title: t('menuSetting.editColField'),  colKey: 'field',  align: 'center', width: 130, },
  { title: t('menuSetting.editColAlign'),    colKey: 'align',   align: 'center', width: 100,  },
  { title: t('menuSetting.editColFixed'),    colKey: 'fixed',   align: 'center', width: 100,},
  { title: t('menuSetting.editColWidth'),    colKey: 'width',   align: 'center', width: 120, },
  { title: t('menuSetting.editColVisible'), colKey: 'visible', align: 'center', width: 90,  },
  { title: t('menuSetting.editColSorter'),    colKey: 'sorter',    align: 'center', width: 80,  },
  { title: t('common.operation'),    colKey: 'actions', align: 'center', width: 80, },
])

const modifyVisible = ref(false)
const saveLoading = ref(false)
const currentMenuStatusId = ref<number | null>(null)
const editColumns = ref<(ColumnConfig & { visible: boolean })[]>([])

function handleModify(row: MenuStatusRow) {
  currentMenuStatusId.value = row.menu_status_id

  editColumns.value = row.column_config.map(col => ({
    ...DEFAULT_COLUMN,
    ...col,
    colKeyInput: col.colKey,  
  }))

  const hasIndex = editColumns.value.some(col => col.colKey === 'index')
  if (!hasIndex) {
    editColumns.value.unshift({
      colKey: 'index',
      colKeyInput: 'index',   
      title: t('menuSetting.colIndex'),
      width: 80,
      fixed: 'left',
      visible: true,
      align: 'center',
      displayIndex: 0,
    })
  }

  const hasActions = editColumns.value.some(col => col.colKey === 'actions')
  if (!hasActions) {
    editColumns.value.push({
      colKey: 'actions',
      colKeyInput: 'actions', 
      title: t('common.operation'),
      width: 120,
      fixed: 'right',
      visible: true,
      align: 'center',
      displayIndex: 0,
    })
  }

  modifyVisible.value = true
}

function resetModifyState() {
  currentMenuStatusId.value = null
  editColumns.value = []
}

/** 新增一列（插入到操作列之前） */
function handleAddColumn() {
  const actionsIndex = editColumns.value.findIndex(col => col.colKey === 'actions')
  // 关键修复：直接使用默认值对象，而不是空对象
  const newCol = { ...DEFAULT_COLUMN }
  
  if (actionsIndex !== -1) {
    editColumns.value.splice(actionsIndex, 0, newCol)
  } else {
    editColumns.value.push(newCol)
  }
}

/** 删除某列（序号列和操作列不可删） */
function handleRemoveColumn(index: number) {
  editColumns.value.splice(index, 1)
}

/** 保存 */
async function handleSaveModify() {
  // 校验：colKeyInput 和 title 不能为空
  const invalid = editColumns.value.some(col => !col.colKeyInput || !col.title)
  if (invalid) {
    MessagePlugin.warning(t('menuSetting.titleFieldRequired'))
    return
  }

  // colKeyInput 不能重复
  const keys = editColumns.value.map(col => col.colKeyInput)
  if (new Set(keys).size !== keys.length) {
    MessagePlugin.warning(t('menuSetting.fieldDuplicate'))
    return
  }

  if (!currentMenuStatusId.value) return
  saveLoading.value = true
  try {
    // 提交时：colKeyInput → colKey，删除 colKeyInput
    const payload = editColumns.value.map((col, index) => {
      const { colKeyInput, ...rest } = col
      return {
        ...rest,
        colKey: colKeyInput,
        displayIndex: index,
      }
    })

    const res = await api.updateMenuStatus(currentMenuStatusId.value, payload)
    if (res.code === 2000) {
      MessagePlugin.success(t('common.saveSuccess'))
      modifyVisible.value = false
      loadList()
    } else {
      MessagePlugin.error(res.message ?? t('common.saveFailed'))
    }
  } catch {
    MessagePlugin.error(t('common.saveRetry'))
  } finally {
    saveLoading.value = false
  }
}
  
  // ==================== 删除 ====================
  function handleDelete(row: MenuStatusRow) {
    const dialog = DialogPlugin.confirm({
      header: t('common.deleteConfirmTitle'),
      body: t('menuSetting.deleteBody', { name: translateServerText(row.menu_name) }),
      theme: 'danger',
      confirmBtn: { content: t('common.confirm'), theme: 'danger' },
      onConfirm: async () => {
        dialog.update({ confirmBtn: { loading: true, content: t('common.deleting'), theme: 'danger' } })
        try {
          const res = await api.deleteMenuStatus(row.menu_status_id)
          if (res.code === 2000) {
            MessagePlugin.success(t('common.deleteSuccess'))
            loadList()
          } else {
            MessagePlugin.error(res.message ?? t('common.deleteFailed'))
          }
        } catch {
          MessagePlugin.error(t('common.deleteRetry'))
        } finally {
          dialog.hide()
        }
      },
      onClose: () => dialog.hide(),
    })
  }
  
  // ==================== 拖拽排序 ====================
  function handleDragSort(params: { currentIndex: number; targetIndex: number; current: any; target: any }) {
    const { currentIndex, targetIndex, current, target } = params

    if (current.fixed || current.colKey === 'index' || current.colKey === 'actions') return
    if (target.fixed || target.colKey === 'index' || target.colKey === 'actions') return

    const item = editColumns.value.splice(currentIndex, 1)[0]
    editColumns.value.splice(targetIndex, 0, item)

    // 拖拽完后按当前顺序重新赋值 displayIndex
    editColumns.value.forEach((col, index) => {
      col.displayIndex = index
    })
  }

  // ==================== 新增列模板 ====================
  const addVisible = ref(false)
  const addLoading = ref(false)
  const addMenuId = ref<number | null>(null)

// 菜单下拉选项
const menuOptions = ref<{ menu_id: number; menu_name: string; menu_type: number }[]>([])
const menuSelectLoading = ref(false)

// 打开弹窗时加载菜单列表
watch(addVisible, async (val) => {
  if (val && menuOptions.value.length === 0) {
    menuSelectLoading.value = true
    try {
      const res = await api.getMenuOptions()
      if (res.code === 2000) {
        menuOptions.value = translateMenuTree(res.data)
      }
    } finally {
      menuSelectLoading.value = false
    }
  }
})

function resetAddState() {
  addMenuId.value = null
}

async function handleSaveAdd() {
  if (!addMenuId.value) {
    MessagePlugin.warning(t('menuSetting.selectMenuFirst'))
    return
  }

  const menu = findMenuInTree(menuOptions.value, addMenuId.value)

  if (menu?.menu_type === 0) {
      MessagePlugin.error(t('menuSetting.menuIsDirectory'))
      return
  }

  addLoading.value = true
  try {
    const res = await api.saveMenuStatus(addMenuId.value)
    if (res.code === 2000) {
      MessagePlugin.success(t('menuSetting.addSuccess'))
      addVisible.value = false
      loadList()
    } else {
      MessagePlugin.error(res.message ?? t('menuSetting.addFailed'))
    }
  } catch {
    MessagePlugin.error(t('menuSetting.addFailedRetry'))
  } finally {
    addLoading.value = false
  }
}

// 递归查询子菜单
const findMenuInTree = (items: any[], id: number): any => {
        for (const item of items) {
            // 如果当前层匹配，直接返回
            if (item.menu_id === id) {
                return item
            }
            // 如果有子节点，递归查找
            if (item.children && item.children.length > 0) {
                const found = findMenuInTree(item.children, id)
                if (found) {
                    return found
                }
            }
        }
        return null // 没找到
    }

// 递归翻译菜单树（用于下拉选择）
const translateMenuTree = (items: any[]): any[] => {
    return (items || []).map((item) => ({
        ...item,
        label: translateServerText(item.menu_name),
        children: item.children ? translateMenuTree(item.children) : undefined,
    }))
}
  </script>
  
  <style scoped lang="scss">
    @import url("./index.scss");
  </style>

<style lang="scss">
.t-select__list .t-select-option.t-is-disabled {
  background: var(--td-brand-color-light) !important;
  // color: var(--td-brand-color) !important;
  font-weight: 500;
  cursor: not-allowed;
}
.t-select__list .t-select-option.t-is-disabled:hover {
  background-color: var(--td-brand-color-light) !important;
}
</style>

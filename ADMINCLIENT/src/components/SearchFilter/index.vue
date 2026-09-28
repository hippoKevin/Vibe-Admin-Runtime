<template>
  <t-popup
    trigger="click"
    placement="bottom-left"
    :overlayStyle="{
      width: '50vw'
    }"
    v-model:visible="isPopupVisible"
    @visible-change="onPopupVisibleChange"
  >
    <template #triggerElement>
      <t-button theme="success">
        <template #icon>
          <SearchIcon />
        </template>
        {{ $t('searchFilter.filter') }}
      </t-button>
    </template>
    <template #content>
      <div style="padding: 10px;">
        <span style="font-size: 20px;">{{ $t('searchFilter.filter') }}</span>
        <t-table
          id="filterTable"
          :maxHeight="600"
          size="small"
          rowKey="id"
          :data="modelValue"
          :columns="filterTableColumns"
          :bordered="false"
          :showHeader="false"
        >
          <template #fieldName="{ row }">
            <t-select
              v-model="row.fieldName"
              :options="filterFields"
              :keys="{ value: 'fieldName', label: 'label' }"
              @change="(value:any) => onFilterNameChange(value, row)"/>
          </template>
          <template #operation="{ row, rowIndex }">
            <t-select
              v-model="row.operation"
              :options="OpeartionSelectOptions[rowIndex]"
            />
          </template>
          <template #fieldValue="{ row }">
            <div v-if="$slots[getSlotName(row)]">
              <slot :name="getSlotName(row)" :row="row"></slot>
            </div>
            <div v-else-if="row.dataType === 'DATE'">
              <t-date-picker v-if="row.operation != 'BW'"
                style="width: 100%;"
                clearable
                v-model="row.fieldValue"
                valueType="YYYY-MM-DD HH:mm:ss"
              />
              <t-date-range-picker v-else
                style="width: 100%;"
                cancelRangeSelectLimit
                clearable
                :needConfirm="false"
                :presets="dateRangePresets"
                presetsPlacement="left"
                valueType="YYYY-MM-DD HH:mm:ss"
                @change="(value:any) => onDateRangeChange(value, row)"
              />
            </div>
            <div v-else-if="row.dataType === 'SELECT'">
              <t-select
                style="width: 100%;"
                v-model="row.fieldValue"
                :options="row.option ? row.option : []"
              />
            </div>
            <div v-else>
              <t-input v-if="row.type === 'STRING'"
                style="width: 100%;"
                clearable
                v-model="row.fieldValue"
              />
              <t-input-number v-if="row.type === 'NUMBER'"
                style="width: 100%;"
                clearable
                v-model="row.fieldValue"
              />
            </div>
          </template>
          <template #addNext="{ row, rowIndex }">
            <t-select
              v-model="row.andNext"
              :options="andNextSelectOptions"
              @change="(value:any) => onAndNextSelectChange(value, rowIndex)"
            />
          </template>
        </t-table>
        <div style="margin-top: 10px;display: flex;justify-content: flex-end;">
          <t-space>
            <t-button theme="default" @click="onResetClick">{{ $t('searchFilter.reset') }}</t-button>
            <t-button theme="primary" @click="onConfirmClick">{{ $t('searchFilter.confirm') }}</t-button>
          </t-space>
        </div>
      </div>
    </template>
  </t-popup>
</template>

<script lang="ts">
export default {
  name: 'SearchFilter'
}
</script>
<script setup lang="ts">
import { ref, type Ref, toRefs, computed } from 'vue';
import { SearchIcon } from 'tdesign-icons-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();


// +参数
// #region 参数
/**
 * * 过滤选项
 */
interface FilterField {
  /**
   * * 字段名
   */
  label: string,
  /**
   * * 字段值
   */
  fieldName: string,
  /**
   * * 字段类型
   */
  fieldType: string,
  /**
   * * 类型
   */
  type: string,
  /**
   * * 输入框类型
   * * 不传-----输入框
   * * SELECT--选择栏
   * * DATE----日期
   */
  dataType?: string,
  /**
   * * 当输入框类型为SELECT时，选择栏的选项
   */
  option?: {
    label: string,
    value: any
  }[]
  /**
   * * 插槽名称
   */
  slot?: string
}
/**
 * * 参数类型
 */
interface Props {
  /**
   * * 字段列表
   */
  filterFields: FilterField[],
  /**
   * * 自动重置数据
   * * 在点击重置按钮后，是否重置数据
   */
  autoReset?: boolean
  /**
   * * 重置后自动关闭
   */
  closeAfterReset?: boolean
  /**
   * * 确认后重置数据
   * * 在点击确认按钮后，是否重置数据
   */
  resetAfterConfirm?: boolean
  /**
   * * 确认后自动关闭
   */
  closeAfterConfirm?: boolean
}
/**
 * * 参数
 */
const props = withDefaults(defineProps<Props>(), {
  autoReset: true, 
  closeAfterReset: true,
  resetAfterConfirm: false,
  closeAfterConfirm: true
})
/**
 * * 解构参数
 */
const { filterFields, autoReset, closeAfterReset, resetAfterConfirm, closeAfterConfirm} = toRefs(props)
/**
 * * 双向绑定
 */
const modelValue = defineModel<FilterData[]>('modelValue', {
  required: true
})
/**
 * * 时间
 */
const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
  (e: 'reset'): void
  (e: 'confirm'): void
}>()

// #endregion 参数

// +按钮
// #region 按钮
/**
 * * 重置按钮
 */
function onResetClick() {
  if (autoReset.value) {
    resetFilterData()
    // initFilterData()
  }
  emit('reset')
  if(closeAfterReset.value) {
    isPopupVisible.value = false
  }
}
/**
 * * 确认按钮
 */
function onConfirmClick() {
  emit('confirm')
  if (resetAfterConfirm.value) {
    // initFilterData()
    resetFilterData()
  }
  if (closeAfterConfirm.value) {
    isPopupVisible.value = false
  }
}

// #endregion 按钮

// +弹出层
// #region 弹出层
/**
 * * 浮层是否可见
 */
const isPopupVisible: Ref<boolean> = ref(false)
/**
 * * 浮层显隐事件
 */
function onPopupVisibleChange(visible: boolean) {
  if (visible && (modelValue.value == null || modelValue.value.length === 0)) {
    initFilterData()
  }
}

// #endregion 弹出层

// +字段名选择框
// #region 字段名选择框
/**
 * * 字段名选择框变化
 */
function onFilterNameChange(value: string, row: FilterData) {
  const filterField = filterFields.value.find((item) => item.fieldName === value)
  if (filterField) {
    row.fieldType = filterField.fieldType
    row.type = filterField.type
    row.fieldValue = null
    row.operation = getOperationDefaultValue(row)
    row.dataType = filterField.dataType ? filterField.dataType : undefined
    row.option = filterField.option ? filterField.option : undefined
  }
}

// #endregion 字段名选择框

// +操作选择框
// #region 操作选择框
/**
 * * 操作选择器选项
 */
const OpeartionSelectOptions = computed(() => {
  return modelValue.value.map((item: any) => {
    switch(item.type) {
      case 'STRING':
        return stringOperationSelectOptions.value
      case 'NUMBER':
        return numberOperationSelectOptions.value
      case 'DATE':
        return dateOperationSelectOptions.value
      default:
        return []
    }
  })
})
/**
 * * 操作选择器默认值
 */
const operationDefaultValue:{
  [key: string]: string
} = {
  STRING: 'INCLUDE',
  NUMBER: 'EQ',
  DATE: 'BW',
}
/**
 * * 获取操作选择器默认值
 */
const getOperationDefaultValue = (row: any) => {
  return operationDefaultValue[row.type]
}
/**
 * * 字符串操作选择器选项
 */
const stringOperationSelectOptions = computed(() => [
{
    label: t('searchFilter.include'),
    value: 'INCLUDE',
  },
  {
    label: t('searchFilter.equal'),
    value: 'EQ',
  },
  {
    label: t('searchFilter.startWith'),
    value: 'STARTWITH',
  },
  {
    label: t('searchFilter.endWith'),
    value: 'ENDWITH',
  },
  {
    label: t('searchFilter.notEqual'),
    value: 'NE',
  },
  {
    label: t('searchFilter.notInclude'),
    value: 'NOTINCLUDE',
  },
])
/**
 * * 数字符号选择器选项
 */
const numberOperationSelectOptions = computed(() => [
  {
    label: t('searchFilter.equal'),
    value: 'EQ',
  },
  {
    label: t('searchFilter.greaterThan'),
    value: 'GT',
  },
  {
    label: t('searchFilter.lessThan'),
    value: 'LT',
  },
  {
    label: t('searchFilter.greaterOrEqual'),
    value: 'GE',
  },
  {
    label: t('searchFilter.lessOrEqual'),
    value: 'LE',
  },
  {
    label: t('searchFilter.notEqual'),
    value: 'NE',
  }
])
/**
 * * 日期符号选择器选项
 */
const dateOperationSelectOptions = computed(() => [
  {
    label: t('searchFilter.equal'),
    value: 'EQ',
  },
  {
    label: t('searchFilter.greaterThan'),
    value: 'GT',
  },
  {
    label: t('searchFilter.lessThan'),
    value: 'LT',
  },
  {
    label: t('searchFilter.greaterOrEqual'),
    value: 'GE',
  },
  {
    label: t('searchFilter.lessOrEqual'),
    value: 'LE',
  },
  {
    label: t('searchFilter.between'),
    value: 'BW',
  }
])

// #endregion 操作选择框

// +数值
// #region 数织
// $日期DATE
// #region 日期
/**
 * * 获取两个日期
 * @param diff 天数差
 * @returns {[String, String]} 今天diff天前, 今天
 */
function getDates(diff: number) {
  // 获取当前日期和时间
  const now = new Date();

  // 计算几天前的日期（减去 diff 天的毫秒数）
  const pastDate = new Date(now.getTime() - diff * 24 * 60 * 60 * 1000);

  // 格式化日期为 YYYY-MM-DD HH:mm:ss 格式
  const format = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  return [format(pastDate), format(now)];
}
/**
 * * 日期范围预设快捷日期选择
 */
const dateRangePresets = computed(() => ({
  [t('searchFilter.lastWeek')]: getDates(7),
  [t('searchFilter.lastMonth')]: getDates(30),
  [t('searchFilter.lastThreeMonths')]: getDates(90),
}))
/**
 * * 日期范围变化
 */
function onDateRangeChange(value: any, row: FilterData) {
  row.fieldValue = value[0]
  row.fieldValue1 = value[1]
}

// #endregion 日期

// #endregion 数值

// +逻辑选择框
// #region 逻辑选择框
enum AndNext {
  OR = "0",
  AND = "1",
  NONE = "-1"
}
/**
 * * 条件选择器选项
 */
const andNextSelectOptions = computed(() => [
  {
    label: t('searchFilter.or'),
    value: AndNext.OR
  },
  {
    label: t('searchFilter.and'),
    value: AndNext.AND
  },
  {
    label: t('searchFilter.noSelection'),
    value: AndNext.NONE
  }
])
/**
 * * 条件选择器选项变化
 */
function onAndNextSelectChange(value: number, rowIndex: number) {
  // 无选择
  // 删除该项后的所有项
  if(value == -1) {
    modelValue.value.splice(rowIndex + 1,)
  }
  // 或者&并且
  // 最后一项时，添加一项
  else if((value == 1 || value ==0) && rowIndex == modelValue.value.length - 1) {
    const item = {
      index: rowIndex + 1,
      ...emptyData,
    }
    modelValue.value.push(item)
  }
}

// #endregion 逻辑选择框

// +表格
// #region 表格
/**
 * * 数据类型
 */
interface FilterData {
  /**
   * * 序号
   */
  index?: number
  /**
   * * 字段名
   */
  fieldName: string
  /**
   * * 字段类型
   */
  fieldType: string
  /**
   * * 字段值
   */
  fieldValue: string|number|null|undefined,
  /**
   * * 额外字段值1
   * * 目前是在于日期范围选择时，用于存储结束日期
   */
  fieldValue1?: string|number|null|undefined,
  /**
   * * 操作
   */
  operation: string,
  /**
   * * 逻辑
   */
  andNext: string
  /**
   * * 类型
   */
  type: string,
  /**
   * * 输入框类型
   */
  dataType?: string,
  /**
   * * 选择器选项
   */
  option?: {
    label: string,
    value: any
  }[]
}
/**
 * * 一行空数据
 */
const emptyData: FilterData = {
  fieldName: '',
  fieldType: '',
  fieldValue: null,
  dataType: 'STRING',
  operation: '',
  andNext: AndNext.NONE,
  type: 'STRING'
}
/**
 * * 初始化数据
 */
function initFilterData() {
  modelValue.value.splice(0, modelValue.value.length)
  const item = {
    index: 0,
    ...JSON.parse(JSON.stringify(emptyData)),
  }
  modelValue.value.push(item)
}
/**
 * * 重置数据
 */
function resetFilterData() {
  modelValue.value = []
}
/**
 * * 表格列配置
 */
const filterTableColumns = computed(() => [
  {
    title: t('searchFilter.fieldName'),
    colKey: 'fieldName',
    cell: 'fieldName',
    align: 'center',
    width: 160
  },
  {
    title: t('searchFilter.operation'),
    colKey: 'operation',
    cell: 'operation',
    align: 'center',
    width: 160
  },
  {
    title: t('searchFilter.fieldValue'),
    colKey: 'fieldValue',
    cell: 'fieldValue',
    align: 'center',
  },
  {
    title: t('searchFilter.logic'),
    colKey: 'addNext',
    cell: 'addNext',
    align: 'center',
    width: 160
  },
])
/**
 * * 获取当前行的插槽名
 */
function getSlotName(row: FilterData) {
  const filterField = filterFields.value.find((item) => item.fieldName === row.fieldName)
  if(filterField && filterField.slot) {
    return filterField.slot
  }
  else {
    return ''
  }
}

// #endregion 表格

// 暴露方法
defineExpose({
  closePopup: () => { isPopupVisible.value = false }
})

</script>

<style scoped>
:global(#filterTable td) {
  padding: 2px 2px !important;
  border: none
}
</style>

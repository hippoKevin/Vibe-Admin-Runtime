<template>
  <t-select-input :value="value" :popup-visible="popupVisible" :popup-props="{
    overlayInnerStyle: { width: '60vw' },
    attach: 'body',
    destroyOnClose: true,
    zIndex: 2500
  }" clearable :placeholder="$t('tableSearchSelect.placeholder')" :value-display="valueDisplay" @clear="onClear"
    @popup-visible-change="onPopupVisibleChange" style="width: 100%; white-space: nowrap; overflow: hidden;">
    <template #panel>
      <t-space direction="vertical" size="small">
        <slot name="header"></slot>
        <t-table id="Table" :maxHeight="350" size="small" :rowKey="rowKey" :loading="loading" :data="data"
          :columns="columns" :bordered="true" hover resizable :activeRowKeys="activeRowKeys" activeRowType="single"
          @row-click="onRowClick">
        </t-table>
        <div v-if="pagination" style="display: flex;align-items: center;justify-content: flex-end;">
          <t-pagination style="width: 45vw;" v-model:current="pagination.current" :total="pagination.total"
            :pageSize="pagination.pageSize" :totalContent="false" :showPageSize="false"
            @current-change="onPageChange" />
        </div>
        <slot name="footer"></slot>
      </t-space>
    </template>
    <template #suffix-icon>
      <chevron-down-icon />
    </template>
  </t-select-input>
</template>

<script lang="ts">
export default {
  name: 'TableSearchSelect'
}
</script>
<script setup lang="ts">
import { computed, nextTick, ref, type Ref, toRefs, watch } from 'vue';
import { ChevronDownIcon } from 'tdesign-icons-vue-next';

// +组件参数
// #region 组件参数
/**
 * * 参数类型
 */
interface Props {
  /**
   * * 表格是否正在加载
   */
  loading?: boolean
  /**
   * * 行标识字段名
   * * 默认为"id"
   */
  rowKey?: string
  /**
   * * 表格数据
   */
  data: any[]
  /**
   * * 表格列配置
   */
  columns: any[]
  /**
   * * 是否存在分页器
   * * 默认为true
   */
  pagination: false | {
    total: number
    current: number
    pageSize: number
  }
  /**
   * * 如何通过行数据获取选中值
   * @param context 行点击事件
   */
  valueGetter: (context: any) => { label: string, value: any }
  /**
   * * 标签回调
   * * 当选项options中不存在value时，使用该回调函数生成标签
   */
  labelFallBack?: (value: any) => any,

  /**
   * 是否阻止外部关闭
   */
  isBlockingExternalClose?: boolean
}
/**
 * * 参数
 */
const props = withDefaults(defineProps<Props>(), {
  loading: false,
  rowKey: 'id',
  pagination: false
})
/**
 * * 解构参数
 */
const { loading, rowKey, data, columns, pagination, valueGetter, labelFallBack, isBlockingExternalClose } = toRefs(props)
/**
 * * 事件
 */
const emit = defineEmits<{
  (e: 'popup-visible-change', visible: boolean): void
  (e: 'change', value: string | number | null | undefined): void
  (e: 'current-change', current: number): void
}>()
/**
 * * 双向绑定
 */
const modelValue = defineModel()

// #endregion 组件参数

// +选择器
// #region 选择器
// $数据
// #region 数据
/**
 * * 下拉框是否可见
 */
const popupVisible = ref(false);
/**
 * * 当前选中的值
 */
const value: Ref<{
  label: string,
  value: string,
} | null> = ref(null)
/**
 * * 当选中值变化时，更新绑定值
 */
watch(value, (val) => {
  if (val == null) {
    modelValue.value = null
  }
  else {
    modelValue.value = val.value
  }
}, { deep: true })
/**
 * * 当绑定值变化时，更新选中值
 * * 仅在绑定值为null/undefined时执行
 */
watch(
  modelValue,
  (val) => {
    // 清空
    if (val === null || val === undefined) {
      value.value = null
      return
    }

    // 已经有 label，不处理
    if (value.value?.value === val) {
      return
    }

    // 编辑回显：只有 id，没有 label
    value.value = {
      value: val,
      label: labelFallBack.value
        ? labelFallBack.value(val)
        : String(val),
    }
  },
  { immediate: true }
)
/**
 * * 自定义选中项
 */
// const valueDisplay = (h: any, { value }: any) => {
//   const option = data.value.find((option) => option[value] == value)
//   if (option) {
//     return option[value]
//   }
//   else {
//     if (labelFallBack.value) {
//       return labelFallBack.value(value)
//     }
//     else {
//       return value
//     }
//   }
// }
const valueDisplay = () => {
  return value.value?.label ?? ''
}
// #endregion 数据

// $方法
// #region 方法
/**
 * * 清空
 */
function onClear() {
  value.value = null
  nextTick(() => {
    emit('change', null)
  })
}
/**
 * * 下拉框显隐
 */
function onPopupVisibleChange(visible: boolean, context?: any) {
  if (!visible && isBlockingExternalClose.value) {
    return   // 屏蔽掉"添加商品"弹窗打开期间的意外关闭
  }
  popupVisible.value = visible;
  emit('popup-visible-change', visible)
}

// #endregion 方法

// #endregion 选择器

// +表格
// #region 表格
/**
 * * 高亮行
 */
const activeRowKeys = computed(() => {
  if (value.value == null) {
    return []
  }
  return [value.value.value]
})
/**
 * * 表格行点击事件
 */
async function onRowClick(context: any) {
  value.value = valueGetter.value(context)
  popupVisible.value = false
  nextTick(() => {
    emit('change', context.row)
  })
}

// #endregion 表格

// +分页
// #region 分页
/**
 * * 页码改变
 * @param current 当前页码
 */
function onPageChange(current: number) {
  emit('current-change', current)
}

// #endregion 分页

defineExpose({
  closePopup: () => { popupVisible.value = false },
})

</script>

<style scoped>
:deep(.t-table) th {
  font-weight: bold;
  color: var(--td-font-gray-1);
}

:deep(.t-table) td {
  padding: 2px 2px !important;
}

:deep(.t-input__inner) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

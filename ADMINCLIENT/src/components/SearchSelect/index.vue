<template>
  <t-select
    v-model:value="selectValue"
     v-model:inputValue="optionSearchForm.ep[filterKey]"
    :popup-props="{
      overlayInnerStyle: overlayInnerStyle
    }"
    :options="slotStatus === true ? [] : options"
    :popup-visible="popupVisible"
    :keys="keys"
    :loading="loading"
    :multiple="multiple"
    :placeholder="$t('searchSelect.placeholder')"
    :filter="() => true"
    filterable
    clearable
    allow-input
    :value-display="valueDisplay"
    @change="onChange"
    @popup-visible-change="onPopupVisibleChange"
    @clear="onClear"
    @search="onSearch"
    :style="style"
  >
    <template #panelTopContent>
      <t-space 
        :style="{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '3px 8px'
        }"
      >
        <span style="font-weight: lighter;">{{ $t('searchSelect.newSelection') }}</span>
        <slot name="panelTopActions">

        </slot>
      </t-space>
    </template>
    <template v-if="slotStatus">
      <t-option
        v-for="(item,index) in options"
        :key="index"
        :label="item.label"
        :value="item.value"
      >
        {{ item.optionContent }}
      </t-option>
    </template>
    <template #panelBottomContent>
      <t-pagination v-if="pagination" :current="optionSearchForm.paging.pageNumber"
        :pageSize="optionSearchForm.paging.pageSize" :total="optionsTotal" size="small" :totalContent="false"
        :showPageSize="false" @current-change="onCurrentChange" :foldedMaxPageBtn="3" :maxPageBtn="5"/>
      <div v-if="selected?.value" class="selected-container">
        <div style="font-weight: lighter;padding: 3px 8px;">{{ $t('searchSelect.selected') }}</div>
        <div style="color: blue;cursor: pointer;padding: 3px 8px;" @click="handleSelectionClick">
          {{ selected.label }}
        </div>
      </div>
    </template>
    <template #suffixIcon>
      <chevron-down-icon />
    </template>
  </t-select>
</template>

<script lang="ts">
export default {
  name: 'SearchSelect',
}
</script>
<script lang="ts" setup>
import { computed, ref, type Ref, toRefs } from 'vue';
import { ChevronDownIcon } from 'tdesign-icons-vue-next';
import requestApi from "@/utils/request/request";
import type { SelectInputValueChangeContext } from 'tdesign-vue-next';

// +组件参数
// #region 组件参数
/**
 * * 参数类型
 */
interface Props {
  /**
   * * 选择器绑定的值，使用v-model
   */
  value?: number | string | number[] | string[] | undefined
  /**
   * * 宽度
   */
  width?: number | string
  /**
   * * 弹出层宽度
   */
  popupWidth?: number | string
  /**
   * * 是否为多选
   */
  multiple?: boolean
  /**
   * * 查询接口地址
   */
  api: string
  /**
   * 接口类型 默认为post
   */
  type?: string,
  /**
   * * 自定义字段别名
   */
  keys?: {
    label: string;
    value: string;
  }
  /**
   * * 是否进行分页查询
   */
  pagination?: boolean | {
    pageSize: number;
  },
  /**
   * 记录选择的数据
   */
  selected?: {
    value: string | number | string[] | number[];
    label: string;
  },
  /**
   * option是否为插槽模式
   */
  slotStatus?: boolean
  /**
   * * 标签回调
   * * 当选项options中不存在value时，使用该回调函数生成标签
   */
  labelFallBack?: (value: any) => any
  /**
   * * 查询结果获取参数
   * * 如何从查询结果result中获取所需的options
   * @param result 查询结果
   */
  resultGetter?: (result: any) => any[]
  /**
   * * 总数结果获取参数
   * * 如何从查询结果result中获取所需的optionsTotal
   */
  totalGetter?: (result: any) => number
  /**
   * * 查询
   * * 如何根据查询接口地址获取结果
   */
  request?: (api: string, data: any, type?: string) => Promise<any>

    /**
   * * 筛选字段
   */
  filterKey?: string,
}
/**
 * * 参数
 */
const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  slotStatus: false,
  keys: () => ({
    label: 'label',
    value: 'value'
  }),
  pagination: () => ({
    pageSize: 5
  }),
  resultGetter: (result: any) => {
    return result.data.data
  },
  totalGetter: (result: any) => {
    return result.data.total
  },
  request: (api: string, data: any, type?: string): Promise<any> => {
    return requestApi({
      url: api,
      method: type ?? 'post',
      params: data,
    })
  },
  filterKey: 'filterValue'
})
/**
 * * 解构参数
 */
const { value, width, popupWidth, multiple, api, type, slotStatus, keys, pagination, selected, labelFallBack, resultGetter, totalGetter, request, filterKey} = toRefs(props);

/**
 * 请求返回的数据
 */
const resData = ref<any>()

/**
 * * 事件
 */
const emit = defineEmits<{
  (e: 'update:value', value: number | string | number[] | string[] | object[] | undefined): void,
  (e: 'change', value: number | string | undefined | number[] | string[], label: number | string | undefined, data?: any): void,
}>()

// #endregion 组件参数

// +样式
// #region 样式
const style = computed(() => {
  if (width.value) {
    if (typeof width.value == 'number') {
      return {
        width: `${width.value}px`
      }
    }
    else {
      return {
        width
      }
    }
  }
  else {
    return {}
  }
})
/**
 * * 弹出层样式
 */
const overlayInnerStyle = computed(() => {
  if (popupWidth.value) {
    if (typeof popupWidth.value == 'number') {
      return {
        width: `${popupWidth.value}px`
      }
    }
    else {
      return {
        width
      }
    }
  }
  else {
    return {}
  }
})

// #endregion 样式

// +选项
// #region 选项
/**
 * * 选项数据类型
 */
interface Option {
  label: string;
  value: number;
  [key: string]: any;
}
/**
 * * 选项
 */
const options: Ref<Option[]> = ref([]);
/**
 * * 选项数据总数
 */
const optionsTotal: Ref<number> = ref(0)
/**
 * * 选项查询参数
 */
 const optionSearchForm = ref({
  ep: {} as Record<string, any>,  
  paging: {
    pageSize: pagination.value == false ? 9999 : (pagination.value == true ? 5 : (pagination.value as any).pageSize),
    pageNumber: 1
  }
})
/**
 * * 查询选项
 */
async function getOptions() {
  try {
    loading.value = true
    const result = await request.value(api.value, optionSearchForm.value, type.value)
    loading.value = false
    if (result.code == 2000) {
      resData.value = result.data.data
      options.value = resultGetter.value(result)
      optionsTotal.value = totalGetter.value(result)
    }
  }
  catch (e) {
    loading.value = false
  }
}

// #endregion 选项

// +选择器
// #region 选择器
// $数据
// #region 数据
/**
 * * 已选值
 */
const selectValue = computed({
  get() {
    return value.value
  },
  set(val) {
    emit('update:value', val)
  }
})
/**
 * * 下拉框是否可见
 */
const popupVisible: Ref<boolean> = ref(false);
/**
 * * 是否正在加载
 */
const loading: Ref<boolean> = ref(false)
/**
 * * 自定义选中项
 */
const valueDisplay = (h: any, { value }: any) => {

  // 多选情况处理
  if (Array.isArray(value)) {
    return value.map(v => {
      const option = options.value.find(opt => opt[keys.value.value] == v);
      return option?.[keys.value.label] || (labelFallBack.value?.(v) ?? v);
    }).join(', ');
  }

  // 单选情况处理
  const option = options.value.find(opt => opt[keys.value.value] == value);

  return option?.[keys.value.label] || (labelFallBack.value?.(value) ?? value);
}

// #endregion 数据
const multipleSelect = ref<any>([])

// $事件
// #region 事件
/**
 * * 选择事件
 */
 function onChange(value: any, label: any) {
  if (resData.value === undefined) return
  
  const data = resData.value[label.option?.index] ?? null
  emit('change', value, label, data) 
}

/**
 * * 清空事件
 */
 function onClear() {
  selectValue.value = undefined
  optionSearchForm.value.ep[filterKey.value] = undefined
  getOptions()
}
/**
 * 下拉框显隐事件
 * @param visible 下拉框是否显示
 */
 function onPopupVisibleChange(visible: boolean, context: SelectInputValueChangeContext) {
  popupVisible.value = visible
  optionSearchForm.value.ep[filterKey.value] = undefined
  if (visible) {
    getOptions()
  }
}
/**
 * * 输入框输入事件
 * @param val 输入值
 */
 const onSearch = (value: string | number, context: SelectInputValueChangeContext) => {
  optionSearchForm.value.ep[filterKey.value] = value
  optionSearchForm.value.paging.pageNumber = 1
  getOptions()
}

/**
 * 已选择点击
 */
const handleSelectionClick = () => {
  if (!selected.value) return;


  // 返回ID和名称
  const result = {
    value: selected.value?.value,
    label: selected.value?.label,
  };

  popupVisible.value = false;
  emit('change', result.value, result.label);  // 触发事件

  // 如果需要重新选择，可以自动聚焦输入框
  const input = document.querySelector('.t-select__input') as HTMLInputElement;
  input?.focus();
};

// #endregion 事件

// $分页
// #region 分页
/**
 * * 分页页码变化事件
 */
function onCurrentChange(current: number) {
  optionSearchForm.value.paging.pageNumber = current
  getOptions()
}

// #endregion 分页

// #endregion 选择器

defineExpose({
  getOptions,
  closePopup: () => { popupVisible.value = false },
  setEp: (ep: Record<string, any>) => { 
    optionSearchForm.value.ep = { ...optionSearchForm.value.ep, ...ep } 
  },
  optionsTotal  
})

</script>

<style lang="less" scoped></style>

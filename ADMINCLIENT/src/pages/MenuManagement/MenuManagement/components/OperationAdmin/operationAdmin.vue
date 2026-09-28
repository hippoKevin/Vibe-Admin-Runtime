<template>
  <t-dialog placement="center"  v-model:visible="visible" destroyOnClose @before-open="beforeOpen" :footer="false" width="80%">
    <template #header>{{ translateServerText(menuLabel) }}{{ $t('operationAdmin.titleSuffix') }}</template>

    <template #body>
      <div class="dialog-body">
        <t-space direction="vertical" style="width: 100%">
          <t-button theme="primary" @click="handleAddOperation">{{ $t('operationAdmin.add') }}</t-button>

          <t-enhanced-table bordered max-height="400px" hover :loading="operationLoading" :columns="operationColumns"
            :data="operationList" resizable tableLayout="fixed">
            <!-- 请求方式标签着色 -->
            <template #operation_name="{ row }">
              {{ translateServerText(row.operation_name) }}
            </template>
            <template #operation_method="{ row }">
              <t-tag v-if="row.operation_method === null" :theme="methodTheme(row.operation_method)" size="large">
                {{ row.operation_method }}
              </t-tag>
            </template>

            <!-- 操作列 -->
            <template #actions="{ row }">
              <t-button variant="text" theme="danger" @click="handleDeleteOperation(row)">
                {{ $t('common.delete') }}
              </t-button>
            </template>
          </t-enhanced-table>
        </t-space>
      </div>
    </template>
  </t-dialog>

  <!-- 新增操作弹窗 -->
  <t-dialog placement="center"  v-model:visible="addOperationVisible" destroyOnClose @confirm="submitAddOperation" :confirmBtn="$t('common.confirm')"
    :cancelBtn="$t('common.cancel')">
    <template #header>{{ $t('operationAdmin.addTitle') }}</template>
    <template #body>
      <div class="dialog-body">
        <t-form ref="addFormRef" :data="addOperationForm" :rules="formRules" label-width="80px">
          <t-form-item :label="$t('operationAdmin.operationName')" name="operation_name">
            <t-input v-model="addOperationForm.operation_name" :placeholder="$t('operationAdmin.operationNamePlaceholder')" />
          </t-form-item>
          <t-form-item :label="$t('operationAdmin.operationSign')" name="operation_sign">
            <t-input v-model="addOperationForm.operation_sign" :placeholder="$t('operationAdmin.operationSignPlaceholder')" />
          </t-form-item>
          <t-form-item :label="$t('operationAdmin.operationPort')" name="operation_port">
            <t-select v-model="addOperationForm.operation_port" :placeholder="$t('operationAdmin.operationPortPlaceholder')"
              :filter="(filterWords, option) => option.value.includes(filterWords)">
              <t-option v-for="value in portList" :key="value.port_id" :value="value.port_address">
                <div v-if="value.port_type === 0">
                  <t-tag theme="primary">{{ value.port_name }}</t-tag>
                </div>
                <div v-if="value.port_type === 1">
                  {{ value.port_name + " " + value.port_address }}
                </div>
              </t-option>
            </t-select>
          </t-form-item>
          <t-form-item :label="$t('operationAdmin.operationMethod')" name="operation_method">
            <t-select v-model="addOperationForm.operation_method" :placeholder="$t('operationAdmin.operationMethodPlaceholder')">
              <t-option value="GET" label="GET" />
              <t-option value="POST" label="POST" />
              <t-option value="PUT" label="PUT" />
              <t-option value="DELETE" label="DELETE" />
            </t-select>
          </t-form-item>
        </t-form>
      </div>
    </template>
  </t-dialog>
</template>

<script lang="ts">
export default { name: 'OperationAdmin' }
</script>

<script setup lang="ts">
import { ref, computed, defineModel } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useI18n } from 'vue-i18n';
import { translateServerText } from '@/locales';
import * as api from './api';

const visible = defineModel('visible');
const { t } = useI18n();

const props = defineProps({
  menuId: { type: Number, default: 0 },
  menuLabel: { type: String, default: '' },
  menuSign: { type: String, default: '' },
});

const emit = defineEmits(['resetMenuList']);

// -------- 子弹窗 --------
const addOperationVisible = ref(false);
const addFormRef = ref(null);

// -------- 表格数据 --------
const operationLoading = ref(false);
const operationList = ref([]);

const operationColumns = computed(() => [
  { title: t('operationAdmin.colName'), colKey: 'operation_name', align: 'center' },
  { title: t('operationAdmin.colSign'), colKey: 'operation_sign', align: 'center' },
  { title: t('operationAdmin.colPort'), colKey: 'operation_port', align: 'center' },
  { title: t('operationAdmin.colMethod'), colKey: 'operation_method', align: 'center' },
  { title: t('common.operation'), colKey: 'actions', align: 'center', width: 100 },
]);

// -------- 表单 --------
const addOperationForm = ref({
  operation_name: '',
  operation_sign: '',
  operation_port: '',
  operation_method: '',
});

const formRules = computed(() => ({
  operation_name: [{ required: true, message: t('operationAdmin.operationNameRequired'), type: 'error' }],
  operation_sign: [{ required: true, message: t('operationAdmin.operationSignRequired'), type: 'error' }],
}));

// 接口列表
const portList = ref([])

// -------- 请求方式颜色映射 --------
const methodTheme = (method: string) => {
  const map: Record<string, string> = {
    GET: 'success', POST: 'warning', PUT: 'primary', DELETE: 'danger'
  };
  return map[method] ?? 'default';
};

// -------- 弹窗打开前：预填接口前缀 + 拉取操作列表 --------
const beforeOpen = () => {
  addOperationForm.value.operation_port = props.menuSign + '.';
  fetchOperationList();
};

// -------- 获取操作列表 --------
const fetchOperationList = () => {
  if (!props.menuId) return;
  operationLoading.value = true;
  api.getOperationList(props.menuId)
    .then((res: any) => {
      if (res.code === 2000) {
        operationList.value = res.data.data;
      }
    })
    .finally(() => { operationLoading.value = false; });
};

// -------- 打开新增弹窗 --------
const handleAddOperation = () => {
  addOperationForm.value = {
    operation_name: '',
    operation_sign: props.menuSign + '.',
    operation_port: '',
    operation_method: '',
  };
  addOperationVisible.value = true;
  getPortList()
};

// 获取接口列表
async function getPortList() {
  const res = await api.getPortList()
    .then(res => {
      if (res.code === 2000) {
        portList.value = res.data;
      } else {
        MessagePlugin.error(t("operationAdmin.getPortFailed"));
      }
    })
}

// -------- 提交新增 --------
const submitAddOperation = async () => {
  const valid = await addFormRef.value?.validate();
  if (valid !== true) return;

  api.addOperation({
    ...addOperationForm.value,
    menu_id: props.menuId,
  }).then((res: any) => {
    if (res.code === 2000) {
      MessagePlugin.success(t('operationAdmin.addSuccess'));
      addOperationVisible.value = false;
      fetchOperationList();       // 刷新操作列表
      emit('resetMenuList');      // 通知父组件刷新菜单树
    }
  });
};

// -------- 删除操作 --------
const handleDeleteOperation = (row: any) => {
  const confirmDia = DialogPlugin.confirm({
    header: t("common.deleteConfirmTitle"),
    body: t("common.deleteConfirmBody"),
    theme: "danger",
    onConfirm: async () => {
      api.deleteOperation(row.operation_id).then((res: any) => {
        if (res.code === 2000) {
          MessagePlugin.success(t('operationAdmin.deleteSuccess'));
          fetchOperationList();
          confirmDia.hide();
        }
      });
    },

  })
};
</script>

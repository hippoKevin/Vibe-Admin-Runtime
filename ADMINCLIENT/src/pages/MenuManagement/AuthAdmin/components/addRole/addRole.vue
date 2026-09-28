<!-- components/addRole/addRole.vue -->
<template>
    <t-dialog placement="center" 
        v-model:visible="visible"
        :header="$t('roleDialog.addTitle')"
        width="500px"
        :confirm-btn="{ loading: submitLoading, content: $t('common.confirm') }"
        @confirm="handleSubmit"
        @close="handleClose"
    >
       <div class="dialog-body">
        <t-form
            ref="formRef"
            :data="formData"
            :rules="rules"
            label-width="80px"
        >
            <t-form-item :label="$t('roleDialog.roleName')" name="role_name">
                <t-input v-model="formData.role_name" :placeholder="$t('roleDialog.roleNamePlaceholder')" clearable />
            </t-form-item>
            <t-form-item :label="$t('roleDialog.unit')" name="role_unit">
                <t-input v-model="formData.role_unit" :placeholder="$t('roleDialog.unitPlaceholder')" clearable />
            </t-form-item>
            <t-form-item :label="$t('roleDialog.dept')" name="role_dept">
                <t-input v-model="formData.role_dept" :placeholder="$t('roleDialog.deptPlaceholder')" clearable />
            </t-form-item>
            <t-form-item :label="$t('roleDialog.remark')" name="role_desc">
                <t-textarea v-model="formData.role_desc" :placeholder="$t('roleDialog.remarkPlaceholder')" :autosize="{ minRows: 3 }" />
            </t-form-item>
        </t-form>
       </div>
    </t-dialog>
</template>

<script lang="ts">
export default { name: 'AddRole' }
</script>

<script lang="ts" setup>
import { ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import type { FormInstanceFunctions, FormRules } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import * as api from './api'

const visible = defineModel('visible')
const { t } = useI18n()
const emit = defineEmits(['resetRoleList'])

// ─── 数据 ─────────────────────────────────────────────────
const formRef = ref<FormInstanceFunctions>()
const submitLoading = ref(false)

const formData = ref({
    role_name: '',
    role_unit: '',
    role_dept: '',
    role_desc: '',
})

const rules: FormRules = {
    role_name: [{ required: true, message: t('roleDialog.roleNameRequired'), trigger: 'blur' }],
    role_alias: [{ required: true, message: t('roleDialog.roleAliasRequired'), trigger: 'blur' }],
}

// ─── 方法 ─────────────────────────────────────────────────

/** 提交 */
const handleSubmit = async () => {
    const valid = await formRef.value?.validate()
    if (valid !== true) return

    submitLoading.value = true
    try {
        const res = await api.addRole(formData.value)
        if (res.code === 2000) {
            MessagePlugin.success(t('roleDialog.addSuccess'))
            emit('resetRoleList')
            handleClose()
        } else {
            MessagePlugin.error(res.message ?? t('roleDialog.addFailed'))
        }
    } catch {
        MessagePlugin.error(t('roleDialog.addFailedRetry'))
    } finally {
        submitLoading.value = false
    }
}

/** 关闭时重置表单 */
const handleClose = () => {
    formRef.value?.reset()
    visible.value = false
}
</script>

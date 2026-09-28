<template>
    <t-dialog placement="center" 
        v-model:visible="visible"
        destroyOnClose
        @before-open="beforeOpen"
        @confirm="handleUpdateRole"
    >

    <template #header>
            {{ $t('roleDialog.updateTitle') }}
        </template>
        <template #body>
            <div class="dialog-body">
                <t-form ref="formRef" :data="formData" :rules="rules">
                <t-form-item :label="$t('roleDialog.roleName')" name="role_name" :rules="[{ required: true, message: $t('roleDialog.roleNameRequired') }]">
                    <t-input v-model="formData.role_name" :placeholder="$t('roleDialog.roleNamePlaceholder')"  :disabled="formData.role_name === '管理员' ? true : false"/>
                </t-form-item>
                <t-form-item :label="$t('roleDialog.unit')" name="role_unit" >
                    <t-input v-model="formData.role_unit" :placeholder="$t('roleDialog.unitPlaceholder')" />
                </t-form-item>
                <t-form-item :label="$t('roleDialog.dept')" name="role_dept" >
                    <t-input v-model="formData.role_dept" :placeholder="$t('roleDialog.deptPlaceholder')" />
                </t-form-item>
                <t-form-item :label="$t('roleDialog.remark')" name="role_desc">
                    <t-input v-model="formData.role_desc" :placeholder="$t('roleDialog.remarkPlaceholder')" />
                </t-form-item>
            </t-form>
            </div>
        </template>
    </t-dialog>
</template>

<script lang="ts">
    export default {
        name: 'updateRolePage'
    }
</script>

<script lang="ts" setup>
    import { ref } from 'vue'
    import * as api from './api'
    import { MessagePlugin } from 'tdesign-vue-next';
    import { useI18n } from 'vue-i18n';


    const visible = defineModel('visible')
    const { t } = useI18n()

    const props = defineProps<{
        roleId: number
    }>()

    const emit = defineEmits(["resetRoleList"])

    /**
     * data 数据
     */

     const formData = ref({
        role_name: '',
        role_unit: '',
        role_dept: 0,
        role_desc: '',
    })

     /**
     * methods 方法
     */

    //页面打开前
    const beforeOpen = () => {
        getRoleDetail()
    }

    /**
     * 获取角色详情
     * Gaining role detail
     */
    const getRoleDetail = () => {
        const res = api.getRoleData(props.roleId)
            .then(res => {
                if (res.code === 2000) { 
                    formData.value = res.data
                }
            })
    }

    /**
     * Submit role update
     * 提交角色更新
     */
    const handleUpdateRole = () => {
        const res = api.updateRoleData(props.roleId,formData.value)
            .then((res) => { 
                if (res.code === 2000) {
                    visible.value = false;
                    emit('resetRoleList')
                    MessagePlugin.success(t('roleDialog.updateSuccess'));
                }
            })
    }
</script>

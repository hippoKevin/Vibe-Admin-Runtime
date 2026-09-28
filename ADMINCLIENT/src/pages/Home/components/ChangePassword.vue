<template>
    <t-dialog placement="center" v-model:visible="visible" :footer="false" destroyOnClose>
        <template #header>
            {{ $t('changePassword.title') }}
        </template>
        <template #body>
            <div class="dialog-body">
                <t-form ref="formRef" :data="formData" :rules="rules" label-width="100px">
                    <t-form-item :label="$t('changePassword.oldPassword')" name="oldPassword">
                        <t-input v-model="formData.oldPassword"
                            :placeholder="$t('changePassword.oldPasswordPlaceholder')" type="password"
                            autocomplete="new-password" />
                    </t-form-item>
                    <t-form-item :label="$t('changePassword.newPassword')" name="newPassword">
                        <t-input v-model="formData.newPassword"
                            :placeholder="$t('changePassword.newPasswordPlaceholder')" type="password"
                            autocomplete="new-password" />
                    </t-form-item>
                    <t-form-item :label="$t('changePassword.confirmPassword')" name="confirmPassword">
                        <t-input v-model="formData.confirmPassword"
                            :placeholder="$t('changePassword.confirmPasswordPlaceholder')" type="password"
                            autocomplete="new-password" />
                    </t-form-item>
                    <t-space style="float: right">
                        <t-button theme="default" @click="visible = false">{{ $t('common.cancel') }}</t-button>
                        <t-button theme="primary" type="submit" @click="confirmChangePassword">{{ $t('common.confirm')}}</t-button>
                    </t-space>
                </t-form>
            </div>
        </template>
    </t-dialog>
</template>

<script lang="ts">
export default {
    name: 'AddRoutePage'
}
</script>

<script lang="ts" setup>
import { MessagePlugin } from 'tdesign-vue-next';
import { reactive, ref } from 'vue';
import * as api from './api'
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

/**
 * 数据参数
 */
// 弹窗显示状态
const visible = defineModel('visible')

// 修改密码表单数据
const formData = reactive({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
})

// 修改密码规则
const rules = reactive({
    oldPassword: [
        { required: true, message: t('changePassword.oldPasswordRequired'), type: 'error' },
    ],
    newPassword: [
        { required: true, message: t('changePassword.newPasswordRequired'), type: 'error' },
    ],
    confirmPassword: [
        { required: true, message: t('changePassword.confirmPasswordRequired'), type: 'error' },
        { validator: (val: string) => val === formData.newPassword, message: t('changePassword.passwordMismatch'), type: 'error' },
    ],
})

const formRef = ref()

/**
 * methods 方法
 */

/**
 * 确认修改密码
 */
const confirmChangePassword = async () => {

    // 验证表单是否通过，不通则则不调用api
    const form_valid = await formRef.value.validate();

    if (form_valid !== true) {
        return
    }

    // 1. 获取用户id
    const userId = JSON.parse(localStorage.getItem('userInfo') || '').user_id

    api.changePassword(userId, formData)
        .then((res: any) => {
            if (res.code === 2000 && res.message === "修改密码成功") {
                // 密码修改成功，清空登录状态返回登录页面
                MessagePlugin.success(t('changePassword.success'))
                visible.value = false
                setTimeout(() => {
                    localStorage.removeItem('userInfo')
                    window.location.href = '/login';
                }, 500);

                // 清空表单数据
                clearFormData()
            } else {
                MessagePlugin.error(res.message)
            }
        })

}

/**
 * 清空表单数据
 */
const clearFormData = () => {
    formData.oldPassword = ''
    formData.newPassword = ''
    formData.confirmPassword = ''
}
</script>

<style lang="scss" scoped></style>

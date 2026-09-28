<template>
    <t-dialog placement="center" v-model:visible="visible" :footer="false" @before-open="beforeDrawerOpen"
        destroyOnClose>
        <template #header>
            {{ $t('personCenter.title') }}
        </template>
        <template #body>
            <div class="dialog-body">
                <t-form ref="formRef" :data="formData" :rules="rules">
                    <t-form-item :label="$t('personCenter.username')" name="username">
                        <t-input v-model:value="formData.username"
                            :placeholder="$t('personCenter.usernamePlaceholder')" />
                    </t-form-item>
                    <t-form-item :label="$t('personCenter.identity')" name="password">
                        <t-input disabled v-model:value="formData.identity"
                            :placeholder="$t('personCenter.identityPlaceholder')" />
                    </t-form-item>
                    <t-form-item :label="$t('personCenter.phone')" name="phone_number">
                        <t-input v-model:value="formData.phone_number"
                            :placeholder="$t('personCenter.phonePlaceholder')" />
                    </t-form-item>
                    <t-form-item :label="$t('personCenter.email')" name="email">
                        <t-input v-model:value="formData.email" :placeholder="$t('personCenter.emailPlaceholder')" />
                    </t-form-item>
                    <t-form-item :label="$t('personCenter.gender')" name="gender">
                        <t-radio-group v-model="formData.gender">
                            <t-radio :value="0">{{ $t('common.unknown') }}</t-radio>
                            <t-radio :value="1">{{ $t('common.male') }}</t-radio>
                            <t-radio :value="2">{{ $t('common.female') }}</t-radio>
                        </t-radio-group>
                    </t-form-item>
                    <t-space style="float: right">
                        <t-button theme="default" @click="visible = false">{{ $t('common.cancel') }}</t-button>
                        <t-button theme="primary" type="submit" @click="updatePersonInfo">{{ $t('common.update')
                            }}</t-button>
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
import { reactive, ref } from 'vue';
import * as api from './api';
import { MessagePlugin } from 'tdesign-vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

/**
 * 生命周期
 */
// 挂载
async function beforeDrawerOpen() {
    getUserInfo()
}


/**
 * 数据参数
 */


// 弹窗显示状态
const visible = defineModel('visible')

const formRef = ref()

// 表单信息
const formData = reactive({
    username: '',
    identity: '',
    phone_number: '',
    email: '',
    gender: 0, // 0-未知 1-男 2-女
})

// 正则表达规则
const regRules = {
    // 用户名：2-10位中文/字母（和后端UpdateUserDto匹配）
    username: /^[\u4e00-\u9fa5a-zA-Z]{2,10}$/,
    // 手机号：支持+86前缀，11位国内有效号段
    phone: /^(\+86)?1[3-9]\d{9}$/,
    // 邮箱：通用主流格式，支持xxx@xxx.com/xxx.xxx@xxx.cn等
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
}

// 表单规则
const rules = reactive({
    username: [
        { required: true, message: t('personCenter.usernameRequired'), trigger: 'blur' },
        { pattern: regRules.username, message: t('personCenter.usernameRule'), trigger: 'blur' }
    ],
    phone_number: [
        { required: true, message: t('personCenter.phoneRequired'), trigger: 'blur' },
        { pattern: regRules.phone, message: t('personCenter.phoneRule'), trigger: 'blur' }
    ],
    email: [
        { required: true, message: t('personCenter.emailRequired'), trigger: 'blur' },
        { pattern: regRules.email, message: t('personCenter.emailRule'), trigger: 'blur' }
    ],
    sex: [
        { required: true, message: t('personCenter.genderRequired'), trigger: 'change' } // 下拉选择建议用change触发，比blur更友好
    ],
})


/**
 * methods 方法
 */

/**
 * 更新个人信息 update person info
 * 
 */
const updatePersonInfo = async () => {
    // 验证表单内容
    const form_valid = await formRef.value.validate();

    if (form_valid !== true) {
        return
    }

    const userId = JSON.parse(localStorage.getItem('userInfo') || '').user_id

    // 更新用户信息
    const updatePersonInfoData = {
        username: formData.username,
        phone_number: formData.phone_number,
        email: formData.email,
        gender: formData.gender,
    }

    api.updatePersonalInfo(userId, updatePersonInfoData)
        .then((res) => {
            if (res.code === 2000) {
                MessagePlugin.success(t('common.updateSuccess'));
                visible.value = false;
            }
        })

}

/**
 * 获取个人信息 get person info
 */
const getUserInfo = async () => {
    const userId = JSON.parse(localStorage.getItem('userInfo') || '').user_id

    api.getPersonalInfo(userId)
        .then(res => {
            if (res.code === 2000) {
                formData.username = res.data.username
                formData.phone_number = res.data.phone_number
                formData.email = res.data.email
                formData.gender = res.data.gender ?? 0
                formData.identity = res.data.role_name
            }
        })
}


</script>

<style lang="scss" scoped></style>

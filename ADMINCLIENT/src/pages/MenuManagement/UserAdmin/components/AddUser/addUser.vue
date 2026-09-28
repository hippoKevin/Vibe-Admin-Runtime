<template>
    <t-dialog placement="center" 
        v-model:visible="visible"
        @confirm="handleAddUser"
        destroyOnClose
    >
        <template #header>
            {{ $t('userDialog.addTitle') }}
        </template>
        <template #body>
            <div class="dialog-body">
                <t-form ref="formRef" :data="formData" :rules="rules">
                <t-form-item :label="$t('userDialog.account')" name="account" :rules="[{ required: true, message: $t('userDialog.accountRequired') }]">
                    <t-input v-model="formData.account" :placeholder="$t('userDialog.accountPlaceholder')" />
                </t-form-item>
                <t-form-item :label="$t('userDialog.password')" name="password" :rules="[{ required: true, message: $t('userDialog.passwordRequired') }]">
                    <t-input v-model="formData.password" :placeholder="$t('userDialog.passwordPlaceholder')" />
                </t-form-item>
                <t-form-item :label="$t('userDialog.username')" name="username" :rules="[{ required: true, message: $t('userDialog.usernameRequired') }]">
                    <t-input v-model="formData.username" :placeholder="$t('userDialog.usernamePlaceholder')" />
                </t-form-item>
                <t-form-item :label="$t('userDialog.roleName')" name="role_name" :rules="[{ required: true, message: $t('userDialog.roleNameRequired') }]">
                    <t-select 
                        v-model="formData.role_name" 
                        :placeholder="$t('userDialog.roleNamePlaceholder')"
                        @change="handleRoleChange"
                    >
                        <t-option 
                            v-for="item in menuList" 
                            :key="item?.role_name" 
                            :label="item?.role_name" 
                            :value="item"
                        />
                    </t-select>
                </t-form-item>
                <t-form-item :label="$t('userDialog.phone')" name="phone_number">
                    <t-input v-model="formData.phone_number" :placeholder="$t('userDialog.phonePlaceholder')" />
                </t-form-item>
                <t-form-item :label="$t('userDialog.email')" name="email">
                    <t-input v-model="formData.email" :placeholder="$t('userDialog.emailPlaceholder')" />
                </t-form-item>
                <t-form-item :label="$t('userDialog.gender')" name="gender">
                    <t-radio-group v-model="formData.gender">
                        <t-radio :value="0">{{ $t('common.unknown') }}</t-radio>
                        <t-radio :value="1">{{ $t('common.male') }}</t-radio>
                        <t-radio :value="2">{{ $t('common.female') }}</t-radio>
                    </t-radio-group>
                </t-form-item>
            </t-form>
            </div>
        </template>
    </t-dialog>
</template>

<script lang="ts">
    export default {
        name: 'AddUserPage'
    }
</script>

<script lang="ts" setup>
    import { onBeforeMount, ref, reactive } from 'vue';
    import * as api from "./api"
    import { MessagePlugin } from 'tdesign-vue-next';
    import { useI18n } from 'vue-i18n';
    
    const visible = defineModel('visible');
    const { t } = useI18n();
    // 获取接收的方法
    const emit = defineEmits(["resetUserList"])

    // 页面打开前
    onBeforeMount(() => {
        gerRoleList()
    })

    /**
     * data 数据
     */

    const formData = ref({
        account: '',
        username: '',
        password: '',
        phone_number: '',
        role_id: '',
        role_name: '',
        email: '',
        gender: 0
    })

    const formRef = ref()

    // 正则表达规则
    const regRules = {
        // 用户名：2-10位中文/字母（和后端UpdateUserDto匹配）
        username: /^[\u4e00-\u9fa5a-zA-Z]{2,10}$/,
        // 手机号：支持+86前缀，11位国内有效号段
        phone: /^(\+86)?1[3-9]\d{9}$/,
        // 邮箱：通用主流格式，支持xxx@xxx.com/xxx.xxx@xxx.cn等
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    }

    const rules = reactive({
        username: [
            { required: true, message: t('userDialog.usernameRequired'), trigger: 'blur' },
            { pattern: regRules.username, message: t('userDialog.usernameRule'), trigger: 'blur' }
        ],
        password: [
            { required: true, message: t('userDialog.passwordRequired'), trigger: 'blur' }
        ],
        account: [
            { required: true, message: t('userDialog.accountRequired'), trigger: 'blur' }
        ],
        role_name: [
            { required: true, message: t('userDialog.roleNameRequired'), trigger: 'change' }
        ],
        phone_number: [
            { pattern: regRules.phone, message: t('userDialog.phoneRule'), trigger: 'blur' }
        ],
        email: [
            { pattern: regRules.email, message: t('userDialog.emailRule'), trigger: 'blur' }
        ],
    })

    // 菜单列表
    const menuList = ref([])

    /**
     * methods 方法
     */

    /**
     * 核心逻辑：处理权限选择变化
     * @param value 
     * @param context
     */
    const handleRoleChange = (value: any) => {
        // 1. 更新 ID
        formData.value.role_id = value.role_id;
        // 2. 更新名称
        formData.value.role_name = value.role_name;
    }

    // 添加菜单
    const handleAddUser = async () => { 
        // 验证表单是否通过，不通则则不调用api
        const form_valid = await formRef.value.validate();
       
       if (form_valid !== true) {
           return
       }

        api.addUser(formData.value)
            .then((res) => { 
                if (res.code === 2000) { 
                    visible.value = false;
                    emit('resetUserList')
                    MessagePlugin.success(t('userDialog.addSuccess'));
                    handleReset()
                }
            })
    }

    /**
     * Gaining Permission List
     * 获取权限列表
     */
    const gerRoleList = async () => {
        const res = await api.getRoleList()
        .then(res => { 
            if (res.code === 2000) { 
                menuList.value = res.data.data
            }
        })
    }


    /**
     * Empty formData
     */
    const handleReset = () => { 
        formData.value = { 
            account: '',
            username: '',
            password: '',
            phone_number: '',
            role_id: '',
            role_name: '',
            email: '',
            gender: 0
        }
    }
</script>

<style lang="scss" scoped>
    @import url("./index.scss");
</style>

<template>
    <div class="container">
        <!-- 装饰卡片：浅蓝渐变，填补四周空白 -->
        <div class="decor-card decor-card--1"></div>
        <div class="decor-card decor-card--2"></div>
        <div class="decor-card decor-card--3"></div>
        <div class="decor-card decor-card--4"></div>
        <div class="decor-card decor-card--5"></div>
        <div class="decor-card decor-card--6"></div>

        <div class="left">
            <div class="logo">
                <img src="./assets/Logo.png" alt="logo" />
                <span>Admin For Entrepreneur</span>
            </div>
            <div class="background">
                <img src="./assets/Background.png" alt="background" />
                <login-particles />
            </div>
        </div>
        <div class="right">
            <div class="login-box">
                <t-space align="top" style="display: flex;justify-content: space-between;">
                    <div>
                        <span>{{ $t('login.welcome') }}</span>
                        <h2 style="margin-bottom: 35px;">汇创 ADMIN</h2>
                    </div>
                    <div class="login-actions">
                        <language-switcher source="login" />
                    </div>
                </t-space>
                <t-form autocomplete="off" ref="formRef" @submit="handleLogin">
                    <t-form-item name="login_name">
                        <!-- autocomplete 禁止自动填充 -->
                        <t-input size="large" :placeholder="$t('login.accountPlaceholder')" name="username" clearable
                            v-model="formData.username">
                            <template #prefix-icon>
                                <user-icon />
                            </template>
                        </t-input>
                    </t-form-item>
                    <t-form-item name="password">
                        <t-input autocomplete="new-password" size="large" type="password" name="password"
                            :placeholder="$t('login.passwordPlaceholder')" clearable v-model="formData.password">
                            <template #prefix-icon>
                                <lock-on-icon />
                            </template>
                        </t-input>
                    </t-form-item>
                    <t-form-item>
                        <t-button shape="round" size="large" theme="primary" type="submit" block
                            :loading="submitLoading">{{ $t('login.login') }}</t-button>
                    </t-form-item>
                </t-form>
                <t-footer style="margin-top: 36px;">Copyright @
                    2025-{{
                        new Date().getFullYear() }}
                    {{ $t('login.copyright') }}</t-footer>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    name: "LoginPage"
}
</script>

<script lang="ts" setup>
import { reactive, ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import * as api from './api';
import { useUserStore } from '@/stores/userStore';
import router from '@/router';
import { useI18n } from 'vue-i18n';
const userStore = useUserStore();
const { t } = useI18n();

onMounted(() => {
    clearLoginData()

    document.documentElement.setAttribute('theme-mode', 'light');
});

/**
 * data 数据
 */

// 表单引用
const formRef = ref();

// 用户登录表单数据
const formData = reactive({
    username: '',
    password: ''
})

// 登录按钮loding状态
const submitLoading = ref(false);

/**
 * methods 功能
 */

// 登录
const handleLogin = () => {
    submitLoading.value = true;

    if (formData.username === '' || formData.password === '') {
        MessagePlugin.warning(t('login.fillWarning'));
        submitLoading.value = false;
        return;
    }

    setTimeout(() => {
        // 登录
        api.login(formData).then((res) => {
                submitLoading.value = false;
                if (res.code === 2000) {
                    // 1.存储返回的信息
                    userStore.saveUserInfo(res.data)
                    MessagePlugin.success(t('login.loginSuccess'))
                    // 清空登录数据
                    setTimeout(() => {
                        // 跳转主页
                        router.replace({
                            name: 'HomePage'
                        })
                        // 清空登录表单数据
                        clearLoginData()
                    }, 300)

                } 
                // else {
                //     // 登录失败（真实后端业务错误 / Mock 用户名或密码错误等），给出明确提示
                //     MessagePlugin.error(res.msg || res.message || t('login.fillWarning'));
                // }
            })
            .catch((err: any) => {
                submitLoading.value = false;
            })
    }, 200);
}

// 清空登录数据
const clearLoginData = () => {
    formData.value = {
        username: '',
        password: '',
    }
}
</script>

<style scoped lang="scss">
@import url("./index.scss");
</style>

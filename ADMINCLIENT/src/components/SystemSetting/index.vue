<template>
    <t-loading fullscreen :text="$t('systemSetting.restoreLoading')" :loading="fullLoading"></t-loading>
    <t-dialog placement="center" v-model:visible="visible" :footer="false" mode="full-screen">
        <template #header>
            <div class="dialog-header">{{ $t('systemSetting.title') }}</div>
        </template>

        <div class="setting-container">

            <!-- 系统信息 -->
            <t-card class="mb16">
                <template #title>
                    <span class="card-title">{{ $t('systemSetting.systemInfo') }}</span>
                </template>
                <template #actions>
                    <t-button theme="default" variant="outline" @click="handleReset">
                        {{ $t('systemSetting.restoreDefault') }}
                        <template #icon>
                            <RefreshIcon />
                        </template>
                    </t-button>
                </template>
                <div class="info-main">
                    <div class="sys-name">
                        汇创 ADMIN
                        <t-tag theme="success" variant="light">
                            <t-icon name="check-circle" /> {{ $t('systemSetting.version') }}
                        </t-tag>
                    </div>
                    <div class="sys-desc">{{ $t('systemSetting.sysDesc') }}</div>
                </div>
            </t-card>

            <!-- 关于我们 -->
            <t-card>
                <template #title>
                    <span class="card-title">{{ $t('aboutUs.title') }}</span>
                </template>
                <div class="about-main">
                    <div class="about-info">
                        <div class="about-row">
                            <span class="about-label">{{ $t('aboutUs.product') }}</span>
                            <span class="about-value">汇创 ADMIN</span>
                        </div>
                        <div class="about-row">
                            <span class="about-label">{{ $t('aboutUs.version') }}</span>
                            <span class="about-value">v1.0.0</span>
                        </div>
                        <div class="about-row">
                            <span class="about-label">{{ $t('aboutUs.author') }}</span>
                            <span class="about-value">Kevin Mao</span>
                        </div>
                        <p class="about-desc">{{ $t('aboutUs.desc') }}</p>
                        <div class="about-links">
                            <a class="about-link" :href="LINKS.github" target="_blank" rel="noopener noreferrer">
                                {{ $t('aboutUs.github') }}
                            </a>
                            <a class="about-link" :href="LINKS.bilibili" target="_blank" rel="noopener noreferrer">
                                {{ $t('aboutUs.bilibili') }}
                            </a>
                        </div>
                    </div>
                    <div class="about-qr">
                        <img class="qr-img" :src="LINKS.qrCode" :alt="$t('aboutUs.officialAccount')" />
                        <div class="qr-tip">{{ $t('aboutUs.officialAccountTip') }}</div>
                    </div>
                </div>
            </t-card>

        </div>
    </t-dialog>
</template>

<script lang="ts">
export default {
    name: 'SystemSetting'
}
</script>

<script setup lang="ts">
import { ref } from 'vue'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { RefreshIcon } from 'tdesign-icons-vue-next';
import * as api from './api'
import { useI18n } from 'vue-i18n'

// ======================= 关于我们 =======================
// 公众号二维码图片存放于 public/qrcode.jpg（构建后位于站点根目录），
// 需要更换时直接替换该图片文件即可，无需修改代码。
const LINKS = {
    github: 'https://github.com/hippoKevin/-TDesign--vue3-nestjs',
    bilibili: 'https://space.bilibili.com/3546758766398015',
    qrCode: '/qrcode.jpg'
}

const visible = defineModel<boolean>('visible')
const { t } = useI18n()

const fullLoading = ref(false)

/**
 * 恢复默认
 */
const handleReset = async () => {

    const dialog = DialogPlugin.confirm({
        header: t('systemSetting.restoreTitle'),
        body: t('systemSetting.restoreBody'),
        theme: 'danger',
        confirmBtn: { content: t('systemSetting.confirmRestore'), theme: 'primary', loading: false },
        onConfirm: async () => {
            fullLoading.value = true
            try {
                const res = await api.resetDefault()
                if (res.code === 2000) {
                    MessagePlugin.success(t('systemSetting.restoreSuccess'))
                    visible.value = false
                }
            } finally {
                fullLoading.value = false
                dialog.hide();
            }
        },
    });
}

</script>

<style scoped lang="scss">
.setting-container {
    padding: 20px;
}

.mb16 {
    margin-bottom: 16px;
}

.dialog-header {
    font-size: 18px;
    font-weight: 600;
}

.card-title {
    font-size: 15px;
    font-weight: 600;
}

/* 系统信息 */
.info-main {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.sys-name {
    font-size: 20px;
    font-weight: 600;
    color: var(--td-text-color-primary);
    display: flex;
    align-items: center;
    gap: 10px;
}

.sys-desc {
    font-size: 13px;
    color: var(--td-text-color-secondary);
    line-height: 1.6;
}

/* 关于我们 */
.about-main {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    align-items: flex-start;
}

.about-info {
    flex: 1;
    min-width: 260px;
}

.about-row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    line-height: 30px;
}

.about-label {
    color: var(--td-text-color-secondary);
    min-width: 72px;
}

.about-value {
    color: var(--td-text-color-primary);
    font-weight: 500;
}

.about-desc {
    margin: 10px 0 14px;
    font-size: 13px;
    line-height: 1.8;
    color: var(--td-text-color-secondary);
}

.about-links {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.about-link {
    display: inline-flex;
    align-items: center;
    padding: 6px 14px;
    border-radius: var(--td-radius-default);
    background: var(--td-brand-color-1);
    color: var(--td-brand-color);
    font-size: 13px;
    text-decoration: none;
    transition: opacity 0.2s;

    &:hover {
        opacity: 0.85;
    }
}

.about-qr {
    flex-shrink: 0;
    text-align: center;
}

.qr-img {
    width: 150px;
    height: 150px;
    border-radius: var(--td-radius-medium);
    border: 1px solid var(--td-component-stroke);
    object-fit: contain;
    background: #fff;
}

.qr-tip {
    margin-top: 8px;
    font-size: 12px;
    color: var(--td-text-color-secondary);
}
</style>

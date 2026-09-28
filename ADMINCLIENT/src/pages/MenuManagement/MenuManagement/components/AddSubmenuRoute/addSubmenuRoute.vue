<template>
    <t-dialog placement="center" 
        v-model:visible="visible"
        @confirm="handleAddRoute"
         @before-open="beforeSubPageOpen"
        destroyOnClose
    >
        <template #header>
            {{ $t('menuDialog.addTitle') }}
        </template>
        <template #body>
            <div class="dialog-body">
                <t-form  ref="formRef" :data="formData" :rules="rules">
                <t-form-item :label="$t('menuDialog.menuName')" name="menu_name" :rules="[{ required: true, message: $t('menuDialog.menuNamePlaceholder') }]">
                    <t-input v-model="formData.menu_name" :placeholder="$t('menuDialog.menuNamePlaceholder')" />
                </t-form-item>
                <t-form-item :label="$t('menuDialog.icon')" name="menu_icon" :rules="[{ required: true, message: $t('menuDialog.iconRequired') }]">
                    <t-select 
                        v-model="formData.menu_icon" 
                        :placeholder="$t('menuDialog.iconPlaceholder')"
                        :scroll="{ type: 'virtual' }"
                        :filter="(filterWords, option) => option.value.includes(filterWords)"
                        clearable
                    >
                        <t-option v-for="item in manifest" :key="item.stem" :value="item.stem">
                            <component :is="getIconComponent(item.icon)" style="margin-right: 8px;" />
                            <span>{{ item.stem }}</span>
                        </t-option>

                        <!-- 前缀图标：选中时显示对应图标，未选中显示搜索图标 -->
                        <template #prefixIcon>
                            <component 
                                v-if="formData.menu_icon"
                                :is="getIconComponent(manifest.find(f => f.stem === formData.menu_icon)?.icon)"
                                style="color: #b1b1a1"
                            />
                            <component v-else :is="icons['SearchIcon']" style="color: #b1b1a1" />
                        </template>
                    </t-select>
                </t-form-item>
                <t-form-item :label="$t('menuDialog.type')" name="menu_type">
                    <t-radio-group v-model="formData.menu_type">
                        <t-radio :value="1">{{ $t('menuManagement.menu') }}</t-radio>
                        <t-radio :value="0">{{ $t('menuManagement.directory') }}</t-radio>
                    </t-radio-group>
                </t-form-item>
                <t-form-item :label="$t('menuDialog.componentName')" name="component_name">
                    <t-input :disabled="formData.menu_type === 0" v-model="formData.component_name" :placeholder="$t('menuDialog.componentNamePlaceholder')" />
                </t-form-item>
                <t-form-item :label="$t('menuDialog.componentAddress')" name="component_address">
                    <t-select :disabled="formData.menu_type === 0" v-model="formData.component_address" :placeholder="$t('menuDialog.componentAddressPlaceholder')"  :filter="(query, option) => option.value.includes(query)">
                        <t-option v-for="item in routesPath" :key="item.name" :value="item.name">
                            {{ item.name }}
                        </t-option>
                    </t-select>
                </t-form-item>
                <t-form-item :label="$t('menuDialog.isCached')" name="is_cached">
                    <t-radio-group :disabled="formData.menu_type === 0" v-model="formData.is_cached">
                        <t-radio :value="true">{{ $t('menuManagement.cached') }}</t-radio>
                        <t-radio :value="false">{{ $t('menuManagement.notCached') }}</t-radio>
                    </t-radio-group>
                </t-form-item>
                <t-form-item :label="$t('menuDialog.isShow')" name="is_show">
                    <t-radio-group :disabled="formData.menu_type === 0" v-model="formData.is_show">
                        <t-radio :value="true">{{ $t('menuManagement.show') }}</t-radio>
                        <t-radio :value="false">{{ $t('menuManagement.hidden') }}</t-radio>
                    </t-radio-group>
                </t-form-item>
                <t-form-item :label="$t('menuDialog.remark')" name="menu_remark">
                    <t-textarea v-model="formData.menu_remark" :placeholder="$t('menuDialog.remarkPlaceholder')" />
                </t-form-item>
            </t-form>
            </div>
        </template>
    </t-dialog>
</template>

<script lang="jsx">
    export default {
        name: 'AddSubmenuRoute'
    }
</script>

<script lang="jsx" setup>
    import {  ref } from 'vue';
    import { manifest } from 'tdesign-icons-vue-next';
    import * as icons from 'tdesign-icons-vue-next';
    import * as api from "./api"
    import { MessagePlugin } from 'tdesign-vue-next';
    import { useI18n } from 'vue-i18n';
    const routesPath = import.meta.glob('@/**/*.vue');
    

    const visible = defineModel('visible');
    const { t } = useI18n();
    const props = defineProps({
        parentMenuId: {
            type: Number,
            default: 0
        },
    })
    // 获取接收的方法
    const emit = defineEmits(["resetMenuList"])

    // 页面打开前
    const beforeSubPageOpen = () => {
        handleReset()
        formData.value.parent_id = props.parentMenuId
    }

    /**
     * data 数据
     */

    const formData = ref({
        menu_name: '',
        menu_icon: '',
        menu_type: 1,
        component_name: '',
        component_address: '',
        is_cached: true,
        is_show: true,
        parent_id: 0,
        menu_remark: ''
    })

    const formRef = ref()

    const rules = ref({
        menu_name: [
            { required: true, message: t('menuDialog.menuNamePlaceholder'), trigger: 'blur' }
        ],
        menu_icon: [
            { required: true, message: t('menuDialog.iconRequired'), trigger: 'blur' }
        ],
    })

    /**
     * methods 方法
     */

   // 获取图标

   const getIconComponent = (iconName) => {
        // 脚本内的TS断言，无解析问题
        return icons[(iconName + 'Icon')];
    };

    // 添加菜单
    const handleAddRoute = () => { 
        api.addMenu(formData.value)
            .then((res) => { 
                if (res.code === 2000) { 
                    visible.value = false;
                    handleReset()
                    emit('resetMenuList')
                    MessagePlugin.success(t('menuDialog.addSuccess'));
                }
            })
    }

    /**
     * 重置菜单
     */
    const handleReset = () => {
        formData.value = {
            menu_name: '',
            menu_icon: '',
            menu_type: 1,
            component_name: '',
            component_address: '',
            is_cached: true,
            is_show: true,
            parent_id: 0,
            menu_remark: ''
        }
    }
</script>

<style lang="scss" scoped>
    @import url("./index.scss");
</style>

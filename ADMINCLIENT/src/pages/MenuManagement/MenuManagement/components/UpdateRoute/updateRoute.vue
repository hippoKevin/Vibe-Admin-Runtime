<template>
    <t-dialog placement="center" 
        v-model:visible="visible"
        destroyOnClose
        @before-open="beforeOpen"
        @confirm="handleUpdate"
    >
        <template #header>
            {{ $t('menuDialog.updateTitle') }}
        </template>
        <template #body>
           <div class="dialog-body">
             <t-form>
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
                    <t-radio-group v-model="formData.menu_type" disabled>
                        <t-radio :value="1">{{ $t('menuManagement.menu') }}</t-radio>
                        <t-radio :value="0">{{ $t('menuManagement.directory') }}</t-radio>
                    </t-radio-group>
                </t-form-item>
                <t-form-item :label="$t('menuDialog.componentName')" name="component_name">
                    <t-input :disabled="formData.menu_type === 0" v-model="formData.component_name" :placeholder="$t('menuDialog.componentNamePlaceholderAlt')" />
                </t-form-item>
                <t-form-item :label="$t('menuDialog.componentAddress')" name="component_address">
                    <t-select :disabled="formData.menu_type === 0" v-model="formData.component_address" clearable :placeholder="$t('menuDialog.componentAddressPlaceholder')"  :filter="(query, option) => option.value.includes(query)">
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
                <t-form-item :label="$t('menuDialog.remark')" name="menuName">
                    <t-textarea v-model="formData.menu_remark" :placeholder="$t('menuDialog.remarkPlaceholder')" />
                </t-form-item>
            </t-form>
           </div>
        </template>
    </t-dialog>
</template>

<script lang="jsx">
    export default {
        name: 'UpdateRoute'
    }
</script>

<script lang="jsx" setup>
    import { ref } from 'vue';
    import { manifest } from 'tdesign-icons-vue-next';
    import * as icons from 'tdesign-icons-vue-next';
    import * as api from "./api";
    import { MessagePlugin } from 'tdesign-vue-next';
    import { useI18n } from 'vue-i18n';
    const routesPath = import.meta.glob('@/**/*.vue');
    

    const visible = defineModel('visible');
    const { t } = useI18n();
    const menuId = defineModel('menuId');

    // 获取接收的方法
    const emit = defineEmits(["resetMenuList"])
    
    /**
     * data 数据
     */

    const formData = ref({
        menu_id: '',
        menu_name: '',
        menu_icon: '',
        menu_type: 0,
        component_name: '',
        component_address: '',
        is_cached: true,
        is_show: true,
        menu_remark: ''
    })

    /**
     * methods 方法
     */

    //页面打开前
    const beforeOpen = () => {
        // 获取页面详情
        getPageDetail()
    }

    // 获取页面详情
    const getPageDetail = () => {
        api.getMenuDetail(menuId.value)
            .then((res) => { 
                if (res.code === 2000) {
                    formData.value = res.data
                }
            })
    }

    // 提交表单
    const handleUpdate = () => {
        api.updateMenu(formData.value)
            .then((res) => { 
                if (res.code === 2000) {
                    visible.value = false;
                    emit('resetMenuList')
                    MessagePlugin.success(t('menuDialog.updateSuccess'));
                }
            })
    }

    const getIconComponent = (iconName) => {
        // 脚本内的TS断言，无解析问题
        return icons[(iconName + 'Icon')];
    };
</script>

<style lang="scss" scoped>
    @import url("./index.scss");
</style>

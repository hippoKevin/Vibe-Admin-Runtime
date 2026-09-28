<template>
    <t-layout style="height: calc(100vh - 56px); overflow: hidden;">
        <t-tabs v-model="menuStore.menuRouterInfo.activeRouter" class="layout-tabs" theme="card" 
            style="border-left: 1px solid #e8e8e8;"
            @change="(val: any) => {
                const find = menuStore.menuRouterInfo.menuRouterList.find(item => item.meta.id == val)
                if (find) router.push(find)
            }"
            @remove="({value}: number) => {
                menuStore.closeMenuRouter(value)
            }"
        >
            <t-tab-panel v-for="(item) in menuStore.menuRouterInfo.menuRouterList" :key="item.meta.id" 
                :value="item.meta.id"
                :removable="true">
                <template #label>
                    <t-dropdown :options="options" trigger="context-menu"
                        @click="({ value }) => { dropdownClick(value, item) }">
                        <div style="display: flex;align-items: center;">
                            <component
                                v-if="getIconComponent(item.meta.icon)"
                                :is="getIconComponent(item.meta.icon)"
                                style="margin-right: 4px; vertical-align: -2px;"
                            />
                            <span>{{ translateServerText(item.meta.menu_name) }}</span>
                        </div>
                    </t-dropdown>
                </template>
            </t-tab-panel>
        </t-tabs>
        
        <t-content class="scrollbar"
            style="padding:10px 4px 10px 10px;height: calc(100vh - 125px); overflow-y: scroll;">
            <!-- ✅ 修复：移除 KeepAlive 上的 v-if，改用条件渲染组件 -->
            <RouterView v-slot="{ Component, route }">
                <KeepAlive :include="cachedComponentNames">
                    <component 
                        :is="Component" 
                        :key="route.fullPath"
                    />
                </KeepAlive>
            </RouterView>
        </t-content>
    </t-layout>
</template>

<script lang="tsx" setup>
    import router from '@/router';
    import { useMenuStore } from '@/stores/menuStore';
    import { computed } from 'vue';
    import { manifest } from 'tdesign-icons-vue-next';
    import * as TDesignIcons from 'tdesign-icons-vue-next';
    import { RefreshIcon, CloseIcon, CloseRectangleIcon, PoweroffIcon } from 'tdesign-icons-vue-next';
    import { useI18n } from 'vue-i18n';
    import { translateServerText } from '@/locales';
    
    const menuStore = useMenuStore();
    const { t } = useI18n();

    // ✅ 修复：确保 name 存在且唯一
    const cachedComponentNames = computed(() => {
        return menuStore.menuRouterInfo.menuRouterList
            .filter((v) => v.meta?.is_cached && v.name)
            .map((v) => v.name as string);
    });

    const options = computed(() => [
        { content: t('tabs.refresh'), value: 1, prefixIcon: () => <RefreshIcon /> },
        { content: t('tabs.close'), value: 2, prefixIcon: () => <CloseIcon /> },
        { content: t('tabs.closeOther'), value: 3, prefixIcon: () => <CloseRectangleIcon /> },
        { content: t('tabs.closeAll'), value: 4, prefixIcon: () => <PoweroffIcon /> },
    ]);

    function dropdownClick(value: any, { meta: { id }, name }: any) {
        console.log(value, id, name);
        switch (value) {
            case 1:
                // 刷新逻辑 - 需要重新创建组件实例
                menuStore.closeMenuRouter(id);
                setTimeout(() => {
                    router.push({ name, query: { _t: Date.now() } });
                }, 100);
                break;
            case 2:
                menuStore.closeMenuRouter(id);
                break;
            case 3:
                menuStore.closeOtherMenuRouter(id);
                break;
            case 4:
                menuStore.clearMenuRouter();
                // 关闭所有
                break;
        }
    }

    const getIconComponent = (iconName: string) => {
        if (!iconName) return undefined;
        const iconInfo = manifest.find(f => f.stem === iconName);
        if (!iconInfo) return undefined;
        const iconComponentName = `${iconInfo.icon}Icon`;
        return TDesignIcons[iconComponentName as keyof typeof TDesignIcons];
    };
</script>

<style scoped>
.layout-tabs :deep(.t-tabs__nav-item) {
    height: 30px;
}
</style>

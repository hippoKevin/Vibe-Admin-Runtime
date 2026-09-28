<template>
    <t-aside class="side-nav" style="height: calc(100vh - 56px)" width="auto">
        <t-menu :width="collapsed ? undefined : sidebarWidth" :collapsed="collapsed" v-model:expanded="menuStore.menuRouterInfo.expanded"  v-model:value="menuStore.menuRouterInfo.activeRouter" >
            <template #logo>
                <span style="overflow: hidden;">{{ $t('sidebar.admin') }}</span>
            </template>
            <template v-for="item in userStore.userInfo.data.menu_list" :key="item.menu_id">
                <t-submenu v-if="item.children" :key="item.menu_id" :value="item.menu_id" :title="translateServerText(item.menu_name)">
                    <!-- <template #icon>
                        <t-icon :name="item.menu_icon" :size="16"/>
                    </template> -->
                    <template #icon>
                        <component :size="16" :is="icon[manifest.find(f => f.stem == item.menu_icon).icon + 'Icon']" />
                    </template>
                    <sub-menu :subMenuList="item.children" />                
                </t-submenu>
                <template v-else>
                    <t-menu-item v-if="item.is_show" :key="item.menu_id" :value="item.menu_id" :to="{
                        path: `/${item.component_name}`,
                        query: {
                            menu_id: item.menu_id
                        }
                    }">
                        <template #icon>
                            <t-icon :name="item.menu_icon" :size="16"/>
                        </template>
                        <span>{{ translateServerText(item.menu_name) }}</span>
                    </t-menu-item>
                </template>
            </template>
            <template #operations>
                <t-button variant="text" shape="square" @click="changeCollapsed">
                <template #icon>
                    <component :is="icon['ViewListIcon']" />
                </template>
                </t-button>
            </template>
        </t-menu>
        <!-- 拖拽把手：像表头一样左右拖动调节侧边栏宽度 -->
        <div
            v-show="!collapsed"
            class="side-nav__resizer"
            :title="$t('sidebar.resize')"
            @mousedown.prevent="startResize"
        ></div>
    </t-aside>
</template>

<script lang="ts">
    export default {
        name: 'LayoutSideNav',
    }
</script>

<script lang="ts" setup>
    import { ref, onBeforeUnmount } from 'vue';
    import { manifest } from 'tdesign-icons-vue-next';
    import * as icon from 'tdesign-icons-vue-next';
    import { useMenuStore } from '@/stores/menuStore';
    import { useUserStore } from '@/stores/userStore';
    import SubMenu from "./SubMenu.vue";
    import { translateServerText } from '@/locales';
    const userStore = useUserStore();
    const menuStore = useMenuStore();

    /**
     * data 数据
     */
    const collapsed = ref(false) // 侧边栏折叠状态

    /** 侧边栏宽度（持久化到 localStorage） */
    const sidebarWidth = ref(Number(localStorage.getItem('sidebar-width')) || 205)
    const SIDEBAR_MIN_WIDTH = 160
    const SIDEBAR_MAX_WIDTH = 320

    let resizeHandlers: { move: (e: MouseEvent) => void; up: () => void } | null = null

    /**
     * methods 方法
     */

    // 切换侧边栏折叠状态
    const changeCollapsed = () => {
        collapsed.value = !collapsed.value;
    };

    /**
     * 开始拖拽调整宽度
     */
    const startResize = (e: MouseEvent) => {
        const startX = e.clientX
        const startWidth = sidebarWidth.value

        const onMove = (ev: MouseEvent) => {
            const next = Math.min(
                SIDEBAR_MAX_WIDTH,
                Math.max(SIDEBAR_MIN_WIDTH, startWidth + ev.clientX - startX)
            )
            sidebarWidth.value = next
        }

        const onUp = () => {
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
            resizeHandlers = null
            localStorage.setItem('sidebar-width', String(sidebarWidth.value))
        }

        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
        resizeHandlers = { move: onMove, up: onUp }
    }

    onBeforeUnmount(() => {
        if (resizeHandlers) {
            document.removeEventListener('mousemove', resizeHandlers.move)
            document.removeEventListener('mouseup', resizeHandlers.up)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    })
</script>

<style scoped lang="scss">
.side-nav {
    position: relative;
}

.side-nav__resizer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 7px;
    z-index: 10;
    cursor: col-resize;

    &::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        right: 3px;
        width: 2px;
        background-color: transparent;
        transition: background-color 0.2s ease;
    }

    &:hover::after,
    &:active::after {
        background-color: var(--td-brand-color);
    }
}
</style>

<template>
    <template v-for="item in subMenuList" :key="item.menu_id">
        <t-submenu v-if="item.children" :key="item.menu_id" :value="item.menu_id" :title="translateServerText(item.menu_name)">
            <template #icon>
                <component :is="icon[manifest.find(f => f.stem == item.menu_icon).icon + 'Icon']" />
            </template>
            <sub-menu :subMenuList="item.children" />
        </t-submenu>
        <!-- <template v-else-if="!item.bi_path">
            <t-menu-item v-if="item.is_show" :key="item.menu_id" :value="item.menu_id" :to="item.component_name">
                <template #icon>
                    <component :is="icon[manifest.find(f => f.stem == item.menu_icon).icon + 'Icon']" />
                </template>
                <span>{{ item.menu_name }}</span>
            </t-menu-item>
        </template> -->
        <template v-else>
            <t-menu-item v-if="item.is_show" :key="item.menu_id" :value="item.menu_id" :to="{
                path: `/${item.component_name}`,
                query: {
                    id: item.menu_id
                }
            }">
                <template #icon>
                    <component :is="icon[manifest.find(f => f.stem == item.menu_icon).icon + 'Icon']" />
                </template>
                <t-tooltip
                    :content="translateServerText(item.menu_name)"
                    placement="right"
                >
                    <span>{{ translateServerText(item.menu_name) }}</span>
                </t-tooltip>
            </t-menu-item>
        </template>
    </template>
</template>

<script lang="js">
   export default {
        name: 'SubMenu',
    }
</script>


<script setup lang="js">
defineProps(['subMenuList'])
import { manifest } from 'tdesign-icons-vue-next';
import * as icon from 'tdesign-icons-vue-next';
import { translateServerText } from '@/locales';
</script>

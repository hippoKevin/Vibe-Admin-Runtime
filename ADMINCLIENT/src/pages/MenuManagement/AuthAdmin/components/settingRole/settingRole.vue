<template>
    <t-drawer
        v-model:visible="visible"
        @before-open="beforeOpen"
        size="900px"
        :footer="true"
        :on-confirm="handleSetAuthorization"
        :on-cancel="() => (visible = false)"
        :confirm-btn="$t('common.confirm')"
        :cancel-btn="$t('common.cancel')"
    >
        <template #header>
            {{ $t('roleDialog.settingTitle') }}
        </template>

        <template #body>
            <t-loading class="container"  :loading="treeLoading" show-overlay>
            <!-- 结构树 object Tree -->
            <t-tree
                ref="tree"
                v-model="menuChecked"
                :data="authMenuList"
                hover
                expand-all
                :check-strictly="false" 
                size="small"
                checkable
                :activable="false"
                :activeMultiple="false"
                :value-mode="'all'"
                :keys="{
                    value: 'menu_id',
                    label: 'label',
                    children: 'children'
                }"
                @change="changeTree"
                :disabled="props.roleName === '' ? true : false"
            >
                <template #operations="{ node }">
                    <div v-if="node.data.operationChildren && node.data.operationChildren.length > 0">
                        <t-checkbox-group
                            style="width: 650px; max-height: 90px; gap: 10px; overflow: auto;"
                            v-model="operationChecked"
                            @change="(vals, ctx) => handleBtnChange(vals, ctx, node)"
                        >
                            <t-checkbox
                                v-for="op in node.data.operationChildren"
                                :key="op.operation_id"
                                :value="op.operation_id"
                                @click.stop
                                :disabled="props.roleName === '' ? true : false"
                            >
                                {{ translateServerText(op.operation_name) }}
                            </t-checkbox>
                        </t-checkbox-group>
                    </div>
                </template>
            </t-tree>
        </t-loading>
        </template>
    </t-drawer>
</template>

<script lang="ts">
export default { name: 'settingRolePage' }
</script>

<script lang="ts" setup>
import { ref } from 'vue'
import * as api from './api'
import { MessagePlugin } from 'tdesign-vue-next'
import type { TreeInstanceFunctions, TreeNodeModel } from 'tdesign-vue-next'
import { useI18n } from 'vue-i18n'
import { translateServerText } from '@/locales'

const visible = defineModel('visible')
const { t } = useI18n()

const props = defineProps<{
    roleId: number
    roleName: string
}>()

// ─── 数据 ────────────────────────────────────────────────
const authMenuList    = ref([])       // 完整权限树
const menuChecked     = ref<number[]>([])  // 已勾选菜单 id
const operationChecked = ref<number[]>([]) // 已勾选操作 id
const tree            = ref<TreeInstanceFunctions>()
const treeLoading     = ref(false)
const submitLoading   = ref(false)

// ─── 生命周期 ─────────────────────────────────────────────

/** 抽屉打开前：先拉菜单树，再回填已有权限 */
const beforeOpen = async () => {
    await getAuthTree()
    await loadRoleAuth()
}

// ─── 方法 ─────────────────────────────────────────────────

/** 1. 获取完整的权限菜单树 */
const getAuthTree = async () => {
    treeLoading.value = true
    const searchForm = {
        paging: {
            pageNumber: 1,
            pageSize: 9999999
        },
    }
    try {
        const res = await api.getAuthMenuList(searchForm)
        if (res.code === 2000) {
            authMenuList.value = translateAuthTree(res.data.data)
        }
    } finally {
        treeLoading.value = false
    }
}

/** 2. 回填角色已有的权限（菜单 + 操作按钮） */
const loadRoleAuth = async () => {
    if (!props.roleId) return
    try {
        const res = await api.getRoleAuthList(props.roleId)
        if (res.code === 2000) {
            menuChecked.value      = res.data.menuIds      ?? []
            operationChecked.value = res.data.operationIds ?? []
        }
    } catch {
        MessagePlugin.error(t('roleDialog.getAuthFailed'))
    }
}

/** 3. 提交权限配置 */
const handleSetAuthorization = async () => {
    submitLoading.value = true
    treeLoading.value = true
    try {
        const res = await api.configRoleAuth(props.roleId, {
            menuIds:      menuChecked.value,
            operationIds: operationChecked.value,
        })
        if (res.code === 2000) {
            MessagePlugin.success(t('roleDialog.configSuccess'))
            visible.value = false
            treeLoading.value = false
        } 
    }  finally {
        submitLoading.value = false
        treeLoading.value = false
    }
}

/** 4. 操作按钮变化：有按钮勾选时强制选中所在菜单 菜单取消时相对应的按钮取消勾选 */
const handleBtnChange = (vals: number[], _ctx: any, node: TreeNodeModel) => {
    const menuId = node.value as number
    if (vals.length > 0) {
        if (!menuChecked.value.includes(menuId)) {
            menuChecked.value = [...menuChecked.value, menuId]
        }
    }
}

/**
 * 递归提取菜单树中所有菜单ID（menuIds）和按钮ID（buttonIds）
 * @param {Object|Array} menuData - 菜单数据（单个菜单对象或菜单数组）
 * @returns {Object} { menuIds: [], buttonIds: [] } - 菜单ID数组和按钮ID数组
 */
 function getMenuAndButtonIds(menuData) {
    // 初始化结果容器，存储所有菜单ID和按钮ID
    const result = {
        menuIds: [],
        buttonIds: []
    };

    // 递归处理单个菜单节点
    function traverseNode(node) {
        // 1. 收集当前节点的菜单ID（确保id存在再添加，避免无效值）
        if (node.menu_id !== undefined && node.menu_id !== null) {
            result.menuIds.push(node.menu_id);
        }

        // 2. 收集当前节点的按钮ID（遍历operationChildren，提取每个按钮的id）
        if (Array.isArray(node.operationChildren) && node.operationChildren.length > 0) {
            const operationIds = node.operationChildren
                .filter(btn => btn.operation_id !== undefined && btn.operation_id !== null) // 过滤无效按钮ID
                .map(btn => btn.operation_id);
            result.buttonIds.push(...operationIds); // 合并到总按钮ID数组
        }

        // 3. 递归处理子节点（若存在子菜单，继续遍历）
        if (Array.isArray(node.children) && node.children.length > 0) {
            node.children.forEach(childNode => traverseNode(childNode));
        }
    }

    // 处理输入数据：若为数组则遍历每个菜单，若为对象则直接处理
    if (Array.isArray(menuData)) {
        menuData.forEach(menu => traverseNode(menu));
    } else if (typeof menuData === 'object' && menuData !== null) {
        traverseNode(menuData);
    }

    return result;
}

function changeTree(value, context) {
    // 1. 从context.node.data中获取所有的菜单id和operationChildren
    console.log(context.node.data);
    const { menuIds, buttonIds } = getMenuAndButtonIds(context.node.data);
    console.log('menuIds:', menuIds, buttonIds);
    if (context.node.checked) {
        // 1.1 向menuChecked、operationChecked添加menuIds, buttonIds，避免重复加入
        // 先复制当前数组，避免直接修改原数组
        const newMenuChecked = [...menuChecked.value];
        const newoperationChecked = [...operationChecked.value];

        // 添加menuIds（不重复）
        menuIds.forEach(menu_id => {
            if (!newMenuChecked.includes(menu_id)) {
                newMenuChecked.push(menu_id);
            }
        });

        // 添加buttonIds（不重复）
        buttonIds.forEach(operation_id => {
            if (!newoperationChecked.includes(operation_id)) {
                newoperationChecked.push(operation_id);
            }
        });

        // 更新ref的值
        menuChecked.value = newMenuChecked;
        operationChecked.value = newoperationChecked;

    } else {
        // 1.2 从menuChecked、operationChecked移除menuIds, buttonIds
        menuChecked.value = menuChecked.value.filter(menu_id => !menuIds.includes(menu_id));
        operationChecked.value = operationChecked.value.filter(operation_id => !buttonIds.includes(operation_id));
    }
}

// 递归翻译权限菜单树
const translateAuthTree = (items: any[]): any[] => {
    return (items || []).map((item) => ({
        ...item,
        label: translateServerText(item.menu_name),
        children: item.children ? translateAuthTree(item.children) : undefined,
        operationChildren: item.operationChildren
            ? item.operationChildren.map((op: any) => ({
                ...op,
                operation_name: translateServerText(op.operation_name),
            }))
            : undefined,
    }))
}
</script>

<style scoped>
    .container :deep(.t-tree__label.t-is-checked ) {
        background-color: transparent !important;
    }
</style>

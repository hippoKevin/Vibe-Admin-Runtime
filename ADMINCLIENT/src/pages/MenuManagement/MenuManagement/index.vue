<template>
    <t-card class="container">
        <template #title>
            <t-space style="font-weight: 500">
                <t-button @click="handleAddRoute">
                    <template #icon>
                        <t-icon name="add"></t-icon>
                    </template>
                    {{ $t('menuManagement.add') }}
                </t-button>
            </t-space>
        </template>

        <template #actions>
            <t-button @click="handleMenuSetting">
                <template #icon>
                    <t-icon name="setting"></t-icon>
                </template>
                {{ $t('menuManagement.menuSetting') }}
            </t-button>
        </template>

        <template #default>
            <div>
                <t-enhanced-table ref="tableRef" :data="routerData.data" :columns="routerColumns" bordered hover
                    resizable :maxHeight="875" tableLayout="fixed" size="small"
                    :tree="treeConfig" row-key="menu_id" :loading="menuLoading" @tree-expand-change="handleExpand"
                    @drag-sort="handleSort" dragSort="row" @change="changeTable">
                <template #menu_icon="{ row }">
                    <t-icon :name="row.menu_icon" :size="'20'"></t-icon>
                </template>
                <template #menuStatus="{ row }">
                    <t-tag :theme="row.menu_type === 0 ? 'warning' : 'success'">{{ row.menu_type === 0
                        ? $t('menuManagement.directory') : $t('menuManagement.menu') }}</t-tag>
                </template>
                <template #isCache="{ row }">
                    <t-tag :theme="row.is_cached ? 'success' : 'warning'">{{ row.is_cached ? $t('menuManagement.cached') :
                        $t('menuManagement.notCached') }}</t-tag>
                </template>
                <template #isShow="{ row }">
                    <t-tag :theme="row.is_show ? 'success' : 'warning'">{{ row.is_show ? $t('menuManagement.show') :
                        $t('menuManagement.hidden') }}</t-tag>
                </template>
                <template #actions="{ row }">
                    <t-space align="center" :size="2" separator="|">
                        <t-button variant="text" theme="warning" size="small" @click="handleUpdate(row)">
                            {{ $t('menuManagement.edit') }}
                        </t-button>
                        <t-button variant="text" theme="primary" size="small" v-if="row.menu_type === 0"
                            @click="handleAddChildMenu(row)">
                            {{ $t('menuManagement.addChildMenu') }}
                        </t-button>
                        <t-button variant="text" theme="primary" size="small" v-if="row.menu_type === 1"
                            @click="hanleOperation(row)">
                            {{ $t('menuManagement.operationAdmin') }}
                        </t-button>
                        <t-button variant="text" theme="danger" size="small" @click="handleDetele(row)">
                            {{ $t('common.delete') }}
                        </t-button>
                    </t-space>
                </template>
                </t-enhanced-table>
            </div>
        </template>

        <template #footer>
            <div style="display: flex;align-items: center;justify-content: space-between;">
                <t-pagination v-model="searchForm.paging.pageNumber" v-model:pageSize="searchForm.paging.pageSize"
                    style="width: 100%;" :total="routerData.total" :page-size-options="[5, 10, 20, 50, 100]"
                    @change="handlePageChange" show-jumper />
            </div>
        </template>
    </t-card>
    <AddRoute v-model:visible="addRouteVisible" @resetMenuList="getMenuList" />
    <UpdateRoute v-model:visible="updateRouteVisible" :menuId="selecteMenuId" @resetMenuList="getMenuList" />
    <AddSubMenuRoute v-model:visible="addChildMenuVisible" :parentMenuId="parentMenuId" @resetMenuList="getMenuList" />
    <OperationAdmin v-model:visible="operationAdminVisible" :menuLabel="selecteMenuLabel" :menuId="selecteMenuId"
        :menuSign="selecteMenuSign" @resetMenuList="getMenuList" />
</template>

<script lang="ts">
export default {
    name: 'MenuManagementPage'
}
</script>

<script lang="ts" setup>
import { DialogPlugin, MessagePlugin, type EnhancedTableProps, type TableRowData } from 'tdesign-vue-next';
import { onMounted, ref, nextTick, computed, type Ref } from 'vue';
import router from '@/router';
import { useI18n } from 'vue-i18n';
import * as api from "./api"

// 子页面
import AddRoute from './components/AddRoute/addRoute.vue';
import UpdateRoute from './components/UpdateRoute/updateRoute.vue';
import AddSubMenuRoute from './components/AddSubMenuRoute/addSubMenuRoute.vue';
import OperationAdmin from './components/OperationAdmin/operationAdmin.vue';

const { t } = useI18n()

// 子页面显示状态
const addRouteVisible = ref(false);
const updateRouteVisible = ref(false);
const addChildMenuVisible = ref(false);
const operationAdminVisible = ref(false);

// 子页面参数
const selecteMenuId = ref(null);
const parentMenuId = ref(0);
const selecteMenuLabel = ref(''); // 选中菜单名称
const selecteMenuSign = ref('');

// 进入页面时
onMounted(() => {
    getMenuList()
})

/**
 * 数据
 */

// 默认展开
const expanded = ref<number[]>(
    JSON.parse(window.localStorage.getItem('expanded') || '[]')
);

// 初始化展开
const isFirstInit = ref(false);

const tableRef = ref(null);

// 菜单表格配置
const treeConfig: EnhancedTableProps['tree'] = ref({
    childrenKey: 'children',
    treeNodeColumnIndex: 1,
    indent: 25,
});

// 菜单表格列模板
const routerColumns = computed(() => [
    {
        title: t('menuManagement.colIndex'),
        width: 75,
        colKey: 'index',
        align: 'center',
        cell: (h: any, { rowIndex }: any) => {
            return (searchForm.value.paging.pageNumber - 1) * searchForm.value.paging.pageSize + rowIndex + 1;
        },
        fixed: "left"
    },
    {
        title: t('menuManagement.colName'),
        align: 'center',
        colKey: 'menu_name',
        fixed: 'left',
        width: 170
    },
    {
        title: t('menuManagement.colIcon'),
        align: 'center',
        colKey: 'menu_icon',
        width: 80
    },
    {
        title: t('menuManagement.colComponent'),
        align: 'center',
        colKey: 'component_name',
        width: 120
    },
    {
        title: t('menuManagement.colComponentAddress'),
        align: 'center',
        colKey: 'component_address',
        width: 180
    },
    {
        title: t('menuManagement.colType'),
        align: 'center',
        colKey: 'menuStatus',
        width: 120
    },
    {
        title: t('menuManagement.colCached'),
        align: 'center',
        colKey: 'isCache',
        width: 120
    },
    {
        title: t('menuManagement.colShow'),
        align: 'center',
        colKey: 'isShow',
        width: 120
    },
    {
        title: t('menuManagement.colRemark'),
        colKey: 'menu_remark',
        align: 'center',
        width: 120
    },
    {
        title: t('common.operation'),
        colKey: 'actions',
        fixed: 'right',
        align: 'center',
        width: 260
    }
])

// 菜单表格数据
const routerData = ref({
    data: [],
    total: 0
})

// 菜单表格加载
const menuLoading = ref(false);


/**
 * * 指令数据查询参数
 */
const searchForm: Ref<{
    ep: {
        moldInfo: string
    },
    paging: {
        pageNumber: number
        pageSize: number
        sortDirection?: string
        sortField?: string
    },
    cdList: any[]
}> = ref({
    ep: {
        moldInfo: ''
    },
    paging: {
        pageNumber: 1,
        pageSize: 10
    },
    cdList: []
})

/**
 * methods
 * 方法
 */

// 获取菜单列表
const getMenuList = () => {
    menuLoading.value = true;
    setTimeout(() => {
        api.getMenuList(searchForm.value)
            .then((res) => {
                menuLoading.value = false;
                if (res.code === 2000) {
                    routerData.value.data = res.data.data;
                    routerData.value.total = res.data.total;

                    const savedKeys: number[] = JSON.parse(window.localStorage.getItem('expanded') || '[]')
                    if (savedKeys.length > 0) {
                        nextTick(() => {
                            savedKeys.forEach(id => {
                                // 找到对应行数据，传给 toggleExpandData
                                const row = routerData.value.data.find((item: any) => item.menu_id === id)
                                if (row) {
                                    tableRef.value?.toggleExpandData({ row })
                                }
                            })
                            isFirstInit.value = true
                        })
                    } else {
                        isFirstInit.value = true
                    }
                }
            })
    }, 200)
}

// 分页改变处理
const handlePageChange = (pageInfo: any) => {
    searchForm.value.paging.pageNumber = pageInfo.current
    searchForm.value.paging.pageSize = pageInfo.pageSize
    getMenuList()
}

// 添加路由
const handleAddRoute = () => {
    addRouteVisible.value = true;
}

/**
 * 添加子菜单
 * @param row 
 */
const handleAddChildMenu = (row: any) => {
    parentMenuId.value = row.menu_id;
    addChildMenuVisible.value = true;
}

// 修改菜单
const handleUpdate = (row: TableRowData) => {
    selecteMenuId.value = row.menu_id;
    updateRouteVisible.value = true;
}

// 删除菜单
const handleDetele = (row: TableRowData) => {
    // 是否删除
    const confirmDia = DialogPlugin.confirm({
        header: t("common.deleteConfirmTitle"),
        theme: "danger",
        body: t('menuManagement.deleteMenuBody'),
        onConfirm: () => {
            try {
                api.deleteMenu(row.menu_id)
                    .then((res: any) => {
                        if (res.code === 2000) {
                            MessagePlugin.success(t("common.deleteSuccess"))
                            getMenuList()
                        }
                    })
            } finally {
                confirmDia.hide()
            }
        },
    })
}

/**
 * Operation Management
 * 操作管理
 */
const hanleOperation = (row: any) => {
    selecteMenuId.value = row.menu_id
    selecteMenuLabel.value = row.menu_name
    selecteMenuSign.value = row.component_name
    operationAdminVisible.value = true
}

/**
 * 保存展开记录 
 * @param value 
 */
const handleExpand = (context: any) => {

    if (!isFirstInit.value) {
        isFirstInit.value = true;
        return;
    }

    const key = Number(context.row.menu_id);
    const isExpanded = !context.rowState.expanded;

    console.log(isExpanded, key)

    if (isExpanded) {
        expanded.value = [...new Set([...expanded.value, key])];
    } else {
        expanded.value = expanded.value.filter((k: number) => k !== key);
    }

    window.localStorage.setItem('expanded', JSON.stringify(expanded.value));
};

/**
 * 排序
 */
/**
* 排序处理 (拖拽排序)
* @param params - TDesign Table 返回的参数
*/
const handleSort = async (params) => {
    //判断是否移动到外部目录了
    if (params.target.children && params.target.children.length > 0) {
        const find = params.target.children.find(f => f.menu_id == params.current.menu_id);
        if (find) {
            MessagePlugin.warning(t('menuManagement.moveWarning'));
            return;
        }
    }
    routerData.value.data = params.newData;
    let newArray = []

    if (params.target.parent_id === 0) {
        newArray = baseMenuSort(params.newData, params.target)
        console.log('newArray', newArray)
    } else {
        newArray = findElementById(params.newData, params.target.menu_id);
    }
    //更新排序
    if (newArray.length < 2) return;
    menuLoading.value = true;
    //重置所有子项的排序从0开始，防止排序错乱
    const updateList = newArray[newArray.length - 2].children.map(async (v, i) => {
        // 去除operationChildren以及children
        delete v.operationChildren;
        delete v.children;
        return api.updateMenu({
            ...v,
            menu_sort: i
        });
    });
    await Promise.all(updateList);
    menuLoading.value = false;
    MessagePlugin.success(t('menuManagement.sortSuccess'));
    getMenuList();
};

// 子级菜单排序

function findElementById(array, id) {
    let result = [];

    function find(element, path) {
        if (element.menu_id === id) {
            result = path;
            return;
        }

        if (element.children && element.children.length > 0) {
            for (let i = 0; i < element.children.length; i++) {
                const child = element.children[i];
                find(child, [...path, child]);
                if (result.length > 0) {
                    return;
                }
            }
        }
    }

    for (let i = 0; i < array.length; i++) {
        const element = array[i];
        find(element, [element]);
        if (result.length > 0) {
            break;
        }
    }

    console.log('result', result);

    return result;
}

// 根目录或菜单排序
function baseMenuSort(array: any[], target) {
    const rootMenus = array.filter(item => item.parent_id === 0);

    rootMenus.map((item, index) => {
        item.menu_sort = index
    })

    return [
        {
            children: rootMenus,
        },
        {
            ...target
        }
    ]
}

/**
 * 菜单配置
 */
const handleMenuSetting = () => {
    router.push({ path: '/MenuSetting' });
}

// 列位置
function changeTable(info: any, context: any) {
    if (info.sorter === undefined) {
        searchForm.value.paging.sortField = null;
        searchForm.value.paging.sortDirection = null;
        getMenuList();
        return
    }
    searchForm.value.paging.sortField = info.sorter?.sortBy || '';
    searchForm.value.paging.sortDirection = info.sorter?.descending ? 'desc' : 'asc';
    searchForm.value.paging.pageNumber = 1;
    getMenuList();
}
</script>

<style lang="scss" scoped>
@import url("./index.scss");
</style>

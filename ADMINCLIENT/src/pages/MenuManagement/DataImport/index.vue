<template>
    <t-loading :loading="fullLoading" :text="$t('dataImport.loadingText')" fullscreen />

    <t-card class="container">
        <template #title>
            <t-space>
                <t-tree-select v-model="menuSelectId" :data="menuOptions"
                    :keys="{ value: 'menu_id', label: 'label', children: 'children' }" :placeholder="$t('dataImport.menuPlaceholder')"
                    clearable filterable style="width: 260px" />
                <t-tooltip :content="$t('dataImport.fileTypeTip')">
                    <t-upload ref="uploadFileRef" v-model="uploadFile" :max="1" :accept="uploadFileType"
                        @fail="handleFail" @success="handleSuccess" :auto-upload="false" />
                </t-tooltip>
                <t-button @click="handleImport">
                    {{ $t('dataImport.import') }}
                    <template #icon>
                        <ImportIcon></ImportIcon>
                    </template>
                </t-button>
            </t-space>
        </template>

        <template #actions>
            <t-space breakLine>
                <!-- <t-button>
                    导入枚举
                    <template #icon>
                        <ImportIcon />
                    </template>
                </t-button> -->
                <t-button theme="success" @click="handleBatchImport">
                    {{ $t('dataImport.batchImport') }}
                    <template #icon>
                        <FileImportIcon></FileImportIcon>
                    </template>
                </t-button>
            </t-space>
        </template>

        <template #default>
            <t-space align="center" style="margin-bottom: 15px;">
                    <div>{{ $t('dataImport.importHistory') }}</div>
                    <t-button theme="danger" variant="text" @click="handleCleanHistory">
                        {{ $t('dataImport.clearHistory') }}
                    </t-button>
                </t-space>
            <div>
                <t-table size="small" :data="tableData.data" :columns="tableColumns" :loading="tableLoading" bordered hover resizable
                    :maxHeight="575" tableLayout="fixed" drag-sort="col" @drag-sort="onDragSort" @column-resize-change="onColumnResizeEnd" @change="changeTable">
                    <template #import_time="{ row }">
                        <div>
                            {{ formatTime(row.import_time) }}
                        </div>
                    </template>
                </t-table>
            </div>
        </template>

        <template #footer>
            <div style="display: flex;align-items: center;justify-content: space-between;">
                <t-pagination v-model="searchForm.paging.pageNumber" v-model:pageSize="searchForm.paging.pageSize"
                    style="width: 100%;" :total="tableData.total" :page-size-options="[5, 10, 20, 50, 100]"
                    @change="handlePageChange" show-jumper />
            </div>
        </template>
    </t-card>

    <BatchImport v-model:visible="batchImportVisible" @resetImportHistory="getImportHistoryList"></BatchImport>
</template>

<script lang="ts">
export default {
    name: 'DataImport',
};
</script>

<script lang="ts" setup>
import { ImportIcon, FileImportIcon } from 'tdesign-icons-vue-next';
import { MessagePlugin } from 'tdesign-vue-next';
import { ref, onMounted, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';


// 其他方法
import { getActionMenuId } from "@/utils/common/getMenuId"
import { formatTime } from "@/utils/common/formatTime"
import { useColumnConfig } from '@/utils/common/useColumnConfig'
import { translateServerText } from '@/locales'
import * as api from "./api"

// 子页面
import BatchImport from './BatchImport/batchImport.vue'

const { t } = useI18n()
const { rawColumns, displayColumns: tableColumns, setColumns, toSubmitColumns, restoreRawTitles } = useColumnConfig()

// 批量导入显示
const batchImportVisible = ref(false)

// 页面打开时
onMounted(
    () => {
        Promise.all([getMenuStatus(), getMenuTree()])
        getImportHistoryList()
    })

/**
 * Data Setting
 * 数据配置
 */

// ==================== 新增列模板 ====================
const menuSelectId = ref<number | null>(null)

// 菜单下拉选项
const menuOptions = ref<{ menu_id: number; menu_name: string; menu_type: number }[]>([])
const menuSelectLoading = ref(false)

// ==================== 基础页面配置项 ====================

// 搜索模板
const searchForm: Ref<{
    ep: {
        username: string
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
        username: ''
    },
    paging: {
        pageNumber: 1,
        pageSize: 10
    },
    cdList: []
})

// 表格加载
const tableLoading = ref(false)

// 表格模板菜单
const menuStatusId = ref(0)

// 表格数据
const tableData = ref(
    {
        data: [],
        total: 0
    }
)

// ==================== 文件 ====================

// 文件ref
const uploadFileRef = ref()

// 绑定的文件数据
const uploadFile = ref<any[]>([])

// 上传的文件类型
const uploadFileType = ref('.xlsx,.csv,.xls')

// 全屏加载
const fullLoading = ref(false)

/**
 * Method Setting
 * 方法配置
 */

/**
 * Gaining menu setting
 * 获取菜单设置
 */
const getMenuStatus = async () => {
    const res = await api.getMenuStatus(getActionMenuId())
        .then(res => {
            if (res.code === 2000) {
                menuStatusId.value = res.data.menu_status_id
                setColumns(
                  res.data.column_config,
                  () => searchForm.value.paging.pageNumber,
                  () => searchForm.value.paging.pageSize
                )
            } else {
                MessagePlugin.error(t("dataImport.getConfigFailed"));
            }
        })
}

/**
 * Set Menu Status
 * 设置菜单状态
 */
const setMenuStatus = async (data: any) => {
    const res = await api.setMenuStatus(menuStatusId.value, data)
        .then(res => {
            if (res.code === 2000) {
                MessagePlugin.success(t("dataImport.saveSuccess"));
            }
        })
}

/**
 * 列位置
 */
const onDragSort = (context: any) => {
    if (context.sort === 'col') {
        rawColumns.value = restoreRawTitles(context.newData)
        setMenuStatus(toSubmitColumns(context.newData))
    }
}

// 分页改变处理
const handlePageChange = (pageInfo: any) => {
    searchForm.value.paging.pageNumber = pageInfo.current
    searchForm.value.paging.pageSize = pageInfo.pageSize
    getImportHistoryList()
}

// 获取菜单树
const getMenuTree = async () => {
    if (menuOptions.value.length === 0) {
        menuSelectLoading.value = true
        try {
            const res = await api.getMenuOptions()
            if (res.code === 2000) {
                menuOptions.value = translateMenuTree(res.data)
            }
        } finally {
            menuSelectLoading.value = false
        }
    }
}

// 批量导入
const handleBatchImport = () => {
    batchImportVisible.value = true
}

// 获取导入历史
const getImportHistoryList = async () => {
    tableLoading.value = true
    try {
        const res = await api.getImportHistory(searchForm.value)
            .then(res => {
                if (res.code === 2000) {
                    tableData.value.data = res.data.data
                    tableData.value.total = res.data.total
                }
            })
    } finally {
        tableLoading.value = false
    }
}

// ----------------文件操作-----------------

/**
 * 导入文件
 */
const handleImport = async () => {
    if (!uploadFile.value || uploadFile.value.length === 0) {
        MessagePlugin.error(t('dataImport.selectFileFirst'))
        return
    }
    if (!menuSelectId.value) {
        MessagePlugin.error(t('dataImport.selectMenuFirst'))
        return
    }

    const menu = findMenuInTree(menuOptions.value, menuSelectId.value)
    if (!menu) {
        MessagePlugin.error(t('dataImport.menuNotFound'))
        return
    }
    if (menu.menu_type === 0) {
        MessagePlugin.error(t('dataImport.menuIsDirectory'))
        return
    }

    const rawFile: File = uploadFile.value[0]?.raw
    if (!rawFile) {
        MessagePlugin.error(t('dataImport.fileReadFailed'))
        return
    }

    // 表名取菜单的 component_name
    const tableName = menu.table_name
    if (!tableName) {
        MessagePlugin.error(t('dataImport.noTableConfig'))
        return
    }

    fullLoading.value = true
    try {
        const res = await api.importData(tableName, rawFile, menu.menu_id)
        if (res.code === 2000) {
            const { total, success, failed, errors } = res.data
            if (failed === 0) {
                MessagePlugin.success(t('dataImport.importSuccessTotal', { total }))
            } else {
                MessagePlugin.warning(t('dataImport.importDone', { success, failed }))
                if (errors?.length) {
                    console.warn('导入失败详情：', errors)
                }
            }
            uploadFile.value = []
            menuSelectId.value = null
            getImportHistoryList()
        } else {
            MessagePlugin.error(res.message ?? t('dataImport.importFailed'))
        }
    } catch (err: any) {
        MessagePlugin.error(err?.response?.data?.message ?? t('dataImport.importFailedFormat'))
    } finally {
        fullLoading.value = false
    }
}

// 导入错误
const handleFail = ({ file }) => {
    MessagePlugin.error(t('dataImport.uploadFailed', { name: file.name }));
};

// 导入成功
const handleSuccess = (params) => {
    MessagePlugin.success(t('dataImport.uploadSuccess'));
};

// 递归翻译菜单树（用于下拉选择）
const translateMenuTree = (items: any[]): any[] => {
    return (items || []).map((item) => ({
        ...item,
        label: translateServerText(item.menu_name),
        children: item.children ? translateMenuTree(item.children) : undefined,
    }))
}

// 递归查询子菜单
const findMenuInTree = (items: any[], id: number): any => {
    for (const item of items) {
        // 如果当前层匹配，直接返回
        if (item.menu_id === id) {
            return item
        }
        // 如果有子节点，递归查找
        if (item.children && item.children.length > 0) {
            const found = findMenuInTree(item.children, id)
            if (found) {
                return found
            }
        }
    }
    return null // 没找到
}

// 清空历史
const handleCleanHistory = () => {
    if (!tableData.value.data || tableData.value.data == [] || tableData.value.total == 0) {
        MessagePlugin.error(t('dataImport.noHistory'))
        return
    }
    const res = api.cleanHistory()
        .then(res => {
            if (res.code === 2000) {
                MessagePlugin.success(t('dataImport.clearSuccess'))
                getImportHistoryList()
            }
        })
}

/**
* ===========================
* 监听表格宽度变化
* ===========================
*/

const onColumnResizeEnd = (context: any) => {
    const columnsWidth = context.columnsWidth

    // 把新宽度合并到 tableColumns
    rawColumns.value = rawColumns.value.map((item: any) => {
        if (columnsWidth[item.colKey] !== undefined) {
            item.width = columnsWidth[item.colKey]
        }
        return item
    })

    // 保存到后端
    setMenuStatus(toSubmitColumns(rawColumns.value))
}

// 列位置
function changeTable(info: any, context: any) {
    if (info.sorter === undefined) {
        searchForm.value.paging.sortField = null;
        searchForm.value.paging.sortDirection = null;
        getImportHistoryList();
        return
    }
    searchForm.value.paging.sortField = info.sorter?.sortBy || '';
    searchForm.value.paging.sortDirection = info.sorter?.descending ? 'desc' : 'asc';
    searchForm.value.paging.pageNumber = 1;
    getImportHistoryList();
}
</script>

<style lang="scss" scoped>
@import url("./index.scss");
</style>

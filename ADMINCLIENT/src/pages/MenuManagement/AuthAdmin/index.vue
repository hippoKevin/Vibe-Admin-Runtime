<template>
  <t-card class="container">
    <template #title>
      <t-space>
        <t-input :placeholder="$t('authAdmin.roleNamePlaceholder')" v-model="searchForm.ep.role_name" clearable style="width: 180px;">

        </t-input>
        <t-button theme="success" @click="handleSearch" :loading="searchLoading">
          {{ $t('common.search') }}
          <template #icon>
            <SearchIcon />
          </template>
        </t-button>
        <t-button @click="addRoleVisible = true">
          {{ $t('common.add') }}
          <template #icon>
            <AddIcon />
          </template>
        </t-button>
      </t-space>

    </template>

    <template #default>
      <div>
        <t-table size="small" @column-resize-change="onColumnResizeEnd" :data="roleData.data" :columns="tableColumns" bordered hover resizable :maxHeight="575"
          tableLayout="fixed" row-key="menu_id" :loading="roleLoading" drag-sort="col" @drag-sort="onDragSort" @change="changeTable">
          <template #actions="{ row }">
            <t-space align="center" :size="2" separator="|">
              <t-button size="small" variant="text" theme="primary" @click="handleModifyRole(row)">
                {{ $t('common.edit') }}
              </t-button>
              <t-button size="small" variant="text" theme="warning" @click="handleSettingRole(row)">
                {{ $t('authAdmin.permission') }}
              </t-button>
              <t-button v-if="row.role_name != '管理员'" size="small" variant="text" theme="danger" @click="handleDeleteRole(row)">
                {{ $t('common.delete') }}
              </t-button>
            </t-space>
          </template>
        </t-table>
      </div>
    </template>

    <template #actions>
      <t-space align="center">
        <SearchFilter v-model="searchForm.cdList" :filter-fields="filterFields" @confirm="onOrderFilterConfirm"
          @reset="onOrderFilterReset">

        </SearchFilter>
        <!-- <t-tooltip content="列设置">
            <SettingIcon size="20px">

            </SettingIcon>
        </t-tooltip> -->
      </t-space>
    </template>

    <template #footer>
      <div style="display: flex;align-items: center;justify-content: space-between;">
        <t-pagination v-model="searchForm.paging.pageNumber" v-model:pageSize="searchForm.paging.pageSize"
          style="width: 100%;" :total="roleData.total" :page-size-options="[5, 10, 20, 50, 100]"
          @change="handlePageChange" show-jumper />
      </div>
    </template>
  </t-card>

  <!-- Sub Pages -->
  <UpdateRole v-model:visible="updateRoleVisible" :roleId="selectRoleId" @resetRoleList="getRoleListData"></UpdateRole>
  <SettingRole v-model:visible="settingRoleVisible" :roleId="selectRoleId" :roleName="selectRoleName"></SettingRole>
  <AddRole v-model:visible="addRoleVisible" @resetRoleList="getRoleListData" />
</template>

<script lang="ts">
export default {
  name: 'UserAdminPage'
}
</script>

<script lang="ts" setup>
import { SearchIcon, AddIcon,SettingIcon } from 'tdesign-icons-vue-next';
import { ref, computed, onMounted, type Ref } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import { getActionMenuId } from "@/utils/common/getMenuId"
import { useColumnConfig } from '@/utils/common/useColumnConfig'
import { useI18n } from 'vue-i18n'
import * as api from "./api"

const { t } = useI18n()
const { rawColumns, displayColumns: tableColumns, setColumns, toSubmitColumns, restoreRawTitles } = useColumnConfig()

// Sub Pages 
import UpdateRole from "./components/UpdateRole/updateRole.vue"
import SettingRole from "./components/SettingRole/settingRole.vue"
import AddRole from "./components/addRole/addRole.vue"


// 页面打开时
onMounted(() => {
  getRoleListData()
  getMenuStatus()
})

/**
 * Sub pages data
 * 子页面数据
 */
// 子页面显示状态
const updateRoleVisible = ref(false)
const addRoleVisible = ref(false)
const settingRoleVisible = ref(false)

const selectRoleId = ref(0)
const selectRoleName = ref('')

/**
 * Data Setting
 * 数据配置
 */

// 表格模板菜单
const menuStatusId = ref(0)

// 搜索模板
const searchForm: Ref<{
  ep: {
    role_name: string
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
    role_name: ''
  },
  paging: {
    pageNumber: 1,
    pageSize: 10
  },
  cdList: []
})

// 搜索加载
const searchLoading = ref(false);

// 表格数据
const roleData = ref(
  {
    data: [],
    total: 0
  }
)

// 表格加载
const roleLoading = ref(false);

/**
 * Method Setting
 * 方法配置
 */

/**
 * 获取菜单配置
 */
const getMenuStatus = async (data: any) => {
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
        MessagePlugin.error(t("authAdmin.getConfigFailed"));
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
        MessagePlugin.success(t("authAdmin.saveSuccess"));
      }
    })
}

/**
 * Get UserList
 * 获取用户列表
 * @param {object} data
 */
async function getRoleListData() {
  searchLoading.value = true
  roleLoading.value = true
  try {
    const res = await api.getRoleList(searchForm.value)
      .then(res => {
        if (res.code === 2000) {
          roleData.value.data = res.data.data
          roleData.value.total = res.data.total
          roleLoading.value = false
        }
      })
  } finally {
    searchLoading.value = false
    roleLoading.value = false
  }
}


/**
 * Search
 * 搜索
 */
async function handleSearch() {
  searchForm.value.paging.pageNumber = 1
  searchForm.value.paging.pageSize = 10
  getRoleListData()
}

/**
 * Modify Role Data
 * 修改权限数据
 */
async function handleModifyRole(row: any) {
  selectRoleId.value = row.role_id
  updateRoleVisible.value = true
}

/**
 * Setting Role
 * 配置权限
 */
async function handleSettingRole(row: any) {
  selectRoleId.value = row.role_id
  selectRoleName.value = row.role_name
  settingRoleVisible.value = true
}

/**
* Delete Role
* 删除权限
*/
async function handleDeleteRole(row: any) {
  const dialog = DialogPlugin.confirm({
    header: t('common.deleteConfirmTitle'),
    body: t('authAdmin.deleteRoleBody', { name: row.role_name }),
    theme: 'danger',
    confirmBtn: { content: t('common.confirm') },
    onConfirm: async () => {
      dialog.update({ confirmBtn: { loading: true, content: t('common.deleting'), theme: 'danger' } })
      try {
        const res = await api.deleteRole(row.role_id)
        if (res.code === 2000) {
          MessagePlugin.success(t('common.deleteSuccess'))
          getRoleListData()
        } else {
          MessagePlugin.error(res.message ?? t('common.deleteFailed'))
        }
      } catch {
        MessagePlugin.error(t('common.deleteRetry'))
      } finally {
        dialog.hide()
      }
    },
    onClose: () => dialog.hide(),
  })
}

// 分页改变处理
const handlePageChange = (searchForm: any) => {
  searchForm.value.paging.pageNumber = searchForm.current
  searchForm.value.paging.pageSize = searchForm.pageSize
  getRoleListData()
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

/**
 * ==========================
 * 过滤
 * ==========================
 */

/**
* * 过滤确认
*/
function onOrderFilterConfirm() {
  searchForm.value.paging.pageNumber = 1
  getRoleListData()
}
/**
 * * 过滤重置
 */
function onOrderFilterReset() {
  searchForm.value.paging.pageNumber = 1
  getRoleListData()
}

/**
  * 过滤字段
  */
const filterFields = computed(() => [
  {
    label: t("authAdmin.filterRoleName"),
    fieldName: "role_name",
    fieldType: "STRING",
    type: "STRING",
  },
  {
    label: t("authAdmin.filterUnit"),
    fieldName: "role_unit",
    fieldType: "STRING",
    type: "STRING",
  },
  {
    label: t("authAdmin.filterDept"),
    fieldName: "role_dept",
    fieldType: "STRING",
    type: "STRING",
    // slot: "oem_man"
  },
])

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
        getRoleListData();
        return
    }
    searchForm.value.paging.sortField = info.sorter?.sortBy || '';
    searchForm.value.paging.sortDirection = info.sorter?.descending ? 'desc' : 'asc';
    searchForm.value.paging.pageNumber = 1;
    getRoleListData();
}
</script>

<style lang="scss" scoped>
@import url("index.scss");
</style>

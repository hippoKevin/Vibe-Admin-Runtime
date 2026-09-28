<template>
    <t-card class="container">
      <template #title>
        <t-space>
          <t-input :placeholder="$t('userAdmin.usernamePlaceholder')" v-model="searchForm.ep.username" clearable style="width: 180px;">

          </t-input>
          <t-button theme="success" :loading="searchLoading" @click="handleSearch" >
            {{ $t('common.search') }}
            <template #icon>
                <SearchIcon />
            </template>
          </t-button>
          <t-button @click="handleAddUser()">
            {{ $t('common.add') }}
            <template #icon>
                <AddIcon />
            </template>
          </t-button>
        </t-space>
        
      </template>

      <template #actions>
                <SearchFilter
                    v-model="searchForm.cdList"
                    :filter-fields="filterFields"
                    @confirm="onOrderFilterConfirm"
                    @reset="onOrderFilterReset"
                >

                </SearchFilter>
        </template>

      <template #default>
        <div>
          <t-table
              :data="userData.data"
              :columns="tableColumns"
              :loading="tableLoading"
              bordered
              hover
              resizable
              :maxHeight="575"
              tableLayout="fixed"
              row-key="menu_id"
              drag-sort="col"
              @drag-sort="onDragSort"
              @column-resize-change="onColumnResizeEnd"
              size="small"
              @change="changeTable"
          >
                <template #gender="{row}">
                  <p v-if="row.gender === 1">
                    {{ $t('common.male') }}
                  </p>
                  <p v-else-if="row.gender === 2">
                    {{ $t('common.female') }}
                  </p>
                  <p v-else>
                    {{ $t('common.unknown') }}
                  </p>
                </template>
                <template #actions="{row}">
                  <t-space align="center" :size="2" separator="|">
                      <t-button
                          variant="text"
                          theme="primary"
                          @click="changeUserInfo(row)"
                          size="small"
                      >
                          {{ $t('common.edit') }}
                      </t-button>
                      <t-button
                          variant="text"
                          theme="danger"
                          @click="deleteUser(row)"
                          size="small"
                          v-if="row.account !== 'admin'"
                      >
                          {{ $t('common.delete') }}
                      </t-button>
                  </t-space>
              </template>
          </t-table>
        </div>
      </template>

      <template #footer>
          <div style="display: flex;align-items: center;justify-content: space-between;">
            <t-button theme="success" variant="outline" :loading="excelTableLoading" @click="handleExportExcel">
              <template #icon>
                <FileExcelIcon color="green"/>
              </template>
              {{ $t('common.export') }}
            </t-button>
            <t-pagination
              style="width: 45vw;"
              :total="userData.total"
              :page-size-options="[5, 10, 20, 50, 100]"
              show-jumper
              v-model="searchForm.paging.pageNumber"
              v-model:pageSize="searchForm.paging.pageSize"
               @change="handlePageChange"
            />
          </div>
      </template>
    </t-card>

    <!-- 子页面 -->
    <AddUser v-model:visible="addUserDialogVisible" @resetUserList="getUserListData"></AddUser>
    <UpdateUser v-model:visible="updateUserDialogVisible" :userId="selectUserId"></UpdateUser>
</template>

<script lang="ts">
  export default {
     name: 'UserAdminPage'
  }
</script>

<script lang="ts" setup>
  import { SearchIcon,FileExcelIcon,AddIcon  } from 'tdesign-icons-vue-next';
  import { DialogPlugin, MessagePlugin } from 'tdesign-vue-next';
  import { ref, computed, onMounted } from 'vue';
  import { useI18n } from 'vue-i18n';
  import AddUser from './components/AddUser/addUser.vue'
  import UpdateUser from './components/UpdateUser/updateUser.vue'
  import { getActionMenuId } from "@/utils/common/getMenuId" 
  import {exportExcel, formatGender} from '@/utils/common/exportExcel'
  import { useColumnConfig } from '@/utils/common/useColumnConfig'
  import * as api from "./api"

  const { t } = useI18n()
  const { rawColumns, displayColumns: tableColumns, setColumns, toSubmitColumns, restoreRawTitles } = useColumnConfig()


  // 页面打开时
  onMounted(
    () => {
    getUserListData();
    getMenuStatus()
  })


  /**
   * Sub page setting
   */
  const addUserDialogVisible = ref(false)
  const updateUserDialogVisible = ref(false)

  // 选中的用户
  const selectUserId = ref(0)

  /**
   * Data Setting
   * 数据配置
   */

  // 搜索按钮loading
  const searchLoading = ref(false)

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

  // 导出加载
  const excelTableLoading = ref(false);

  // 表格模板菜单
  const menuStatusId = ref(0)

  // 表格加载
  const tableLoading = ref(false)

  // 表格数据
  const userData = ref(
      {
          data: [],
          total: 0
    }
  )

  /**
   * Method Setting
   * 方法配置
   */

  /**
   * Gaining menu setting
   * 获取菜单设置
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
          MessagePlugin.error(t("userAdmin.getConfigFailed"));
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
            MessagePlugin.success(t("userAdmin.saveSuccess"));
          } 
        })
    }

  /**
   * Search User
   * 搜索用户
   */
  async function handleSearch() {
    searchLoading.value = true
    tableLoading.value = true
    const res = await api.getUserList(searchForm.value)
    .then((res: any) => {
      if (res.code === 2000) {
        userData.value.data = res.data.data
        userData.value.total = res.data.total
        searchLoading.value = false
        tableLoading.value = false
      }
    })
  }

  /**
   * Get UserList
   * 获取用户列表
   * @param {object} data
   */
  async function getUserListData() {
    tableLoading.value = true
    try {
      const res = await api.getUserList(searchForm.value)
      .then((res: any) => {
        if (res.code === 2000) {
          userData.value.data = res.data.data
          userData.value.total = res.data.total
          tableLoading.value = false
        }
        
      })
    } finally {
      tableLoading.value = false
    }
  }

  /**
   * Add User
   * 添加用户
   */
  async function handleAddUser() {
    addUserDialogVisible.value = true
  }


  /**
   * Change User Info
   * 修改用户信息
   */
  async function changeUserInfo(row: any) {
    selectUserId.value = row.user_id
    updateUserDialogVisible.value = true
  }

  /**
   * Delete User
   * 删除用户
   */
  async function deleteUser(row: any) {
    const confirmDia = DialogPlugin.confirm({
      header: t("common.deleteConfirmTitle"),
      body:   t("common.deleteConfirmBody"),
      theme:  "danger",
      onConfirm: async () => {
        const result = await api.deleteUser(row.user_id)
        .then(res => {
          if (res.code == 2000) {
            MessagePlugin.success(t('common.deleteSuccess'))
            confirmDia.hide()
            getUserListData()
          }
        })
      },

    })
  }

  /**
   * 列位置
   */
   const onDragSort = (context: any) => {
    if (context.sort === 'col') {
      rawColumns.value = restoreRawTitles(context.newData);
      // 本地存储数据，提交保存
      setMenuStatus(toSubmitColumns(context.newData))
    }
  }

  // 分页改变处理
  const handlePageChange = (pageInfo: any) => {
        searchForm.value.paging.pageNumber = pageInfo.current
        searchForm.value.paging.pageSize = pageInfo.pageSize
        getUserListData()
    }

  /**
   * export excel
   * 导出excel
   */
  async function handleExportExcel() {
    excelTableLoading.value = true
    try {
      // 1. 深拷贝表单，防止影响原搜索条件
      const localSearchForm = JSON.parse(JSON.stringify(searchForm.value))
      
      // 2. 修改分页参数
      localSearchForm.page = 1
      localSearchForm.pageSize = 100000 
      
      // 3. 请求数据
      const res: any = await api.getUserList(localSearchForm)
      
      if (res.code === 2000) {
        // 4. 调用通用导出函数
        exportExcel({
          data: res.data.data,
          fileName: t('userAdmin.exportFileName'),
          columns: tableColumns.value,
          excludeKeys: ['password', 'user_id', 'role_id'],
          formatters: {
            gender: formatGender
          }
        })
      } else {
        MessagePlugin.error(res.msg || t('userAdmin.fetchFailed'))
      }
    } catch (error) {
      console.error(error)
      MessagePlugin.error(t('userAdmin.exportError'))
    } finally {
      excelTableLoading.value = false
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
      getUserListData()
  }
  /**
   * * 过滤重置
   */
  function onOrderFilterReset() {
      searchForm.value.paging.pageNumber = 1
      getUserListData()
  }

   /**
     * 过滤字段
     */
     const filterFields = computed(() => [
        {
            label: t("userAdmin.filterUsername"),
            fieldName: "username",
            fieldType: "STRING",
            type: "STRING",
        },
        {
            label: t("userAdmin.filterRole"),
            fieldName: "role_name",
            fieldType: "STRING",
            type: "STRING",
        },
        {
            label: t("userAdmin.filterPhone"),
            fieldName: "phone_number",
            fieldType: "STRING",
            type: "STRING",
            // slot: "oem_man"
        },
        {
            label: t("userAdmin.filterEmail"),
            fieldName: "email",
            fieldType: "STRING",
            type: "STRING",
            // slot: "cust"
        },
        {
            label: t("userAdmin.filterGender"),
            fieldName: "gender",
            fieldType: "SHORT",
            type: "NUMBER",
            dataType: "SELECT",
            option: [
                {
                    label: t("common.unknown"),
                    value: 0
                },
                {
                    label: t("common.male"),
                    value: 1
                },
                {
                    label: t("common.female"),
                    value: 2
                }
            ]
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
        getUserListData();
        return
    }
    searchForm.value.paging.sortField = info.sorter?.sortBy || '';
    searchForm.value.paging.sortDirection = info.sorter?.descending ? 'desc' : 'asc';
    searchForm.value.paging.pageNumber = 1;
    getUserListData();
}
</script>

<style lang="scss" scoped>
  @import url("index.scss");
</style>

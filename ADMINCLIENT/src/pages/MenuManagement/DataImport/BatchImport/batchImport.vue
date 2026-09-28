<template>
     <t-loading :loading="fullLoading" :text="$t('dataImport.loadingText')" fullscreen />
    <t-dialog placement="center" 
      v-model:visible="visible"
      :header="$t('batchImport.title')"
      width="700px"
      :confirm-btn="{ content: $t('batchImport.startImport'), loading: importLoading }"
      @confirm="handleBatchImport"
      @close="handleClose"
      destroyOnClose
    >
      <div class="dialog-body">
        <t-space direction="vertical" style="width: 100%">
  
  <!-- 文件上传（支持多文件） -->
  <t-upload
    v-model="uploadFiles"
    multiple
    accept=".xlsx,.xls"
    :auto-upload="false"
    theme="file-input"
    :placeholder="$t('batchImport.uploadPlaceholder')"
    @change="onFileChange"
  />

  <t-alert
    theme="info"
    :message="$t('batchImport.fileMatchAlert')"
  />

  <!-- 文件匹配预览 -->
  <div v-if="filePreview.length > 0">
    <div style="font-size: 14px; margin-bottom: 8px; font-weight: 500;">
      {{ $t('batchImport.filePreviewTitle') }}
    </div>
    <t-table
      :data="filePreview"
      :columns="previewColumns"
      size="small"
      bordered
      row-key="fileName"
      :maxHeight="375"
    >
      <template #status="{ row }">
        <t-tag :theme="row.matched ? 'success' : 'danger'" size="small">
          {{ row.matched ? $t('batchImport.matchedTag', { table: row.tableName }) : $t('batchImport.unmatchedTag') }}
        </t-tag>
      </template>

      <!-- ─── 操作列 ─────────────────────────────────────────── -->
      <template #actions="{ row }">
        <t-button
          variant="text"
          theme="danger"
          size="small"
          @click="handleRemoveFile(row)"
        >
          {{ $t('common.delete') }}
        </t-button>
      </template>
    </t-table>

    <div style="margin-top: 8px; font-size: 12px; color: var(--td-text-color-secondary);">
      {{ $t('batchImport.countSummary', {
        total: filePreview.length,
        matched: filePreview.filter(f => f.matched).length,
        unmatched: filePreview.filter(f => !f.matched).length
      }) }}
    </div>
  </div>

  <!-- 导入结果 -->
  <div v-if="importResults?.length > 0">
    <div style="font-size: 14px; margin-bottom: 8px; font-weight: 500;">
      {{ $t('batchImport.resultTitle') }}
    </div>
    <t-table
      :data="importResults"
      :columns="resultColumns"
      size="small"
      bordered
      row-key="fileName"
      :maxHeight="375"
    >
      <template #result="{ row }">
        <t-tag :theme="row.failed === 0 ? 'success' : 'warning'" size="small">
          {{ $t('batchImport.successCount', { success: row.success, total: row.total }) }}
        </t-tag>
      </template>
      <template #errors="{ row }">
        <t-popup
          v-if="row.errors?.length"
          trigger="click"
          placement="left"
        >
          <t-button variant="text" theme="danger" size="small">
            {{ $t('batchImport.errorCount', { count: row.errors.length }) }}
          </t-button>
          <template #content>
            <div style="max-height: 200px; overflow-y: auto; padding: 8px; max-width: 300px;">
              <div
                v-for="(err, i) in row.errors"
                :key="i"
                style="font-size: 12px; margin-bottom: 4px; color: var(--td-error-color);"
              >
                {{ err }}
              </div>
            </div>
          </template>
        </t-popup>
        <span v-else style="color: var(--td-success-color); font-size: 12px;">{{ $t('batchImport.noError') }}</span>
      </template>
    </t-table>
  </div>

</t-space>
      </div>
    </t-dialog>
  </template>
  
  <script lang="ts">
  export default { name: 'BatchImport' }
  </script>
  
  <script setup lang="ts">
  import { ref, computed } from 'vue'
  import { MessagePlugin } from 'tdesign-vue-next'
  import { useI18n } from 'vue-i18n'
  import * as api from './api'
  
  const visible = defineModel('visible')
  const { t } = useI18n()
  const emit = defineEmits(['success','resetImportHistory'])

  // 全屏加载
  const fullLoading = ref(false)
  
  // ─── 文件列表 ──────────────────────────────────────────────────────
  const uploadFiles = ref<any[]>([])
  const importLoading = ref(false)
  
  // ─── 文件匹配预览 ──────────────────────────────────────────────────
  interface FilePreview {
    fileName: string
    pureName: string
    matched: boolean
    tableName: string
    menuId: number | null
    rowCount: number
  }
  const filePreview = ref<FilePreview[]>([])
  
  // ─── 导入结果 ──────────────────────────────────────────────────────
  interface ImportResult {
    fileName: string
    tableName: string
    total: number
    success: number
    failed: number
    errors: string[]
  }
  const importResults = ref<ImportResult[]>([])
  
  // ─── 表格列定义 ────────────────────────────────────────────────────
  const previewColumns = computed(() => [
    { title: t('batchImport.colFileName'),   colKey: 'fileName', width: 180 },
    { title: t('batchImport.colRowCount'), colKey: 'rowCount', width: 80, align: 'center' },
    { title: t('batchImport.colStatus'), colKey: 'status',   align: 'center' },
    { title: t('common.operation'),     colKey: 'actions',  align: 'center', width: 80 },
  ])
  
  const resultColumns = computed(() => [
    { title: t('batchImport.colFileName'),   colKey: 'fileName',  width: 180 },
    { title: t('batchImport.colImportTable'),   colKey: 'tableName', width: 140 },
    { title: t('batchImport.colResult'), colKey: 'result',    align: 'center', width: 140 },
    { title: t('batchImport.colErrors'), colKey: 'errors',    align: 'center' },
  ])
  
  // ─── 文件变化时预览匹配结果 ────────────────────────────────────────
  const onFileChange = async (files: any[]) => {
    filePreview.value = []
    importResults.value = []
    if (!files || files.length === 0) return
  
    // 获取菜单列表（含 table_name 字段）
    const menuRes = await api.getMenuOptions()
    const menuList: any[] = menuRes.code === 2000 ? menuRes.data : []
    const flatMenus = flattenMenuTree(menuList)
  
    const { read, utils } = await import('xlsx')
  
    for (const uploadFile of files) {
      const rawFile: File = uploadFile.raw
      if (!rawFile) continue
  
      const pureName = rawFile.name.replace(/\.(xlsx|xls)$/i, '')
  
      // 用 menu_name 匹配，取 table_name 作为目标表
      const menu = flatMenus.find(m => m.menu_name === pureName)
  
      const buffer = await rawFile.arrayBuffer()
      const wb = read(buffer, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = utils.sheet_to_json(sheet, { defval: null })
  
      filePreview.value.push({
        fileName:  rawFile.name,
        pureName,
        matched:   !!menu?.table_name,      
        tableName: menu?.table_name ?? '',  
        menuId:    menu?.menu_id ?? null,
        rowCount:  rows.length,
      })
    }
  }
  
  // ─── 删除预览项 ────────────────────────────────────────────────────
  const handleRemoveFile = (row: FilePreview) => {
    // 从预览列表移除
    const previewIndex = filePreview.value.findIndex(f => f.fileName === row.fileName)
    if (previewIndex !== -1) {
      filePreview.value.splice(previewIndex, 1)
    }
  
    // 同步从 uploadFiles 移除，保证 FormData 不会带上已删除的文件
    const fileIndex = uploadFiles.value.findIndex(
      f => f.raw?.name === row.fileName,
    )
    if (fileIndex !== -1) {
      uploadFiles.value.splice(fileIndex, 1)
    }
  
    MessagePlugin.success(t('batchImport.removeSuccess', { name: row.fileName }))
  }
  
  // ─── 批量导入 ──────────────────────────────────────────────────────
  const handleBatchImport = async () => {
    importResults.value = []
    fullLoading.value = true
  
    if (!uploadFiles.value || uploadFiles.value.length === 0) {
      MessagePlugin.error(t('batchImport.selectFileFirst'))
      return
    }
  
    const matchedFiles = filePreview.value.filter(f => f.matched)
    if (matchedFiles.length === 0) {
      MessagePlugin.error(t('batchImport.noMatched'))
      return
    }
  
    importLoading.value = true
    try {
      const formData = new FormData()
      for (const uploadFile of uploadFiles.value) {
        const rawFile: File = uploadFile.raw
        if (rawFile) {
          formData.append('files', rawFile, rawFile.name)
        }
      }
  
      const res = await api.batchImportData(formData)
      if (res.code === 2000) {
        importResults.value = res.data.results
  
        const totalSuccess = res.data.results.reduce(
          (sum: number, r: ImportResult) => sum + r.success, 0,
        )
        const totalFailed = res.data.results.reduce(
          (sum: number, r: ImportResult) => sum + r.failed, 0,
        )
  
        if (totalFailed === 0) {
          MessagePlugin.success(t('batchImport.importSuccess', { total: totalSuccess }))
          visible.value = false
          handleClose()
          emit('resetImportHistory')
        } else {
          MessagePlugin.warning(
            t('batchImport.importDone', { success: totalSuccess, failed: totalFailed }),
          )
        }
      } else {
        MessagePlugin.error(res.message ?? t('batchImport.importFailed'))
      }
    } catch (err: any) {
      MessagePlugin.error(err?.response?.data?.message ?? t('batchImport.importFailed'))
    } finally {
      importLoading.value = false
      fullLoading.value = false
    }
  }
  
  // ─── 关闭重置 ──────────────────────────────────────────────────────
  const handleClose = () => {
    uploadFiles.value = []
    filePreview.value = []
    importResults.value = []
  }
  
  // ─── 工具：扁平化菜单树 ────────────────────────────────────────────
  const flattenMenuTree = (menus: any[]): any[] => {
    const result: any[] = []
    const traverse = (items: any[]) => {
      items.forEach(item => {
        result.push(item)
        if (item.children?.length) traverse(item.children)
      })
    }
    traverse(menus)
    return result
  }
  </script>

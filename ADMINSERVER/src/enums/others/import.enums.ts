export const ENUM_REGISTRY: Record<string, {
  displayEnum: Record<string, string>
  importEnum: Record<string, number | string>
}> = {
  // 性别 1=男 0=女
  'common.gender': {
    displayEnum: { '0': '女', '1': '男' },
    importEnum:  { '女': 0, '男': 1 },
  },

  // 在职状态 1=在职 0=离职
  'common.working_status': {
    displayEnum: { '0': '离职', '1': '在职' },
    importEnum:  { '离职': 0, '在职': 1 },
  },

  // 启用状态 1=启用 0=禁用
  'common.status': {
    displayEnum: { '0': '禁用', '1': '启用' },
    importEnum:  { '禁用': 0, '启用': 1 },
  },

  'user_list.gender': {
    displayEnum: { '0': '未知', '1': '男', '2': '女' },
    importEnum:  { '未知': 0, '男': 1, '女': 2 },
  },
}
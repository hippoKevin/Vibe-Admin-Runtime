/**
 * ============================================================
 * 前端自动 Mock（仅开发环境）
 * ------------------------------------------------------------
 * 机制：
 *  - 数据全部来自项目根目录 mock/*.json（不把数据硬编码进 TS）
 *  - 当后端无法连接（网络层错误）且当前为开发环境
 *    （import.meta.env.DEV === true）且 VITE_ENABLE_MOCK === 'true' 时，
 *    request/index.ts 会调用本模块，按“URL + Method”命中映射，
 *    返回与真实后端完全一致的响应结构：
 *      成功：{ code: 2000, message, data }
 *      失败：{ code, msg, data: null }
 *  - 后端正常时本模块完全不参与；生产环境永不启用。
 * ============================================================
 */
import usersData from '../../../../mock/users.json'
import rolesData from '../../../../mock/roles.json'
import menusData from '../../../../mock/menus.json'
import operationsData from '../../../../mock/operations.json'
import menuStatusData from '../../../../mock/menu_status.json'
import importHistoryData from '../../../../mock/import_history.json'
import portsData from '../../../../mock/ports.json'

export type MockEnv = {
  DEV?: boolean
  VITE_ENABLE_MOCK?: string
}

export type MockMode = 'off' | 'auto' | 'force'

/**
 * Mock 模式（仅开发环境生效，生产永远 off）：
 *  - off  ：关闭 Mock，全部请求后端
 *  - auto ：先请求后端，后端不可用/出错时自动切换 Mock
 *  - force：所有已映射接口直接返回 Mock，完全不请求后端
 *
 * 取值约定：`true` / `1` / `force` → force（纯 Mock）
 *           `auto` → auto（自动回退）
 *           其它 / 空 → off
 */
export function mockMode(env: MockEnv = import.meta.env): MockMode {
  if (!env.DEV) return 'off'
  const value = String(env.VITE_ENABLE_MOCK ?? '').trim().toLowerCase()
  if (value === 'auto') return 'auto'
  if (value === 'true' || value === '1' || value === 'force') return 'force'
  return 'off'
}

/** 是否允许使用 Mock（auto / force 都算启用） */
export function isMockEnabled(env: MockEnv = import.meta.env): boolean {
  return mockMode(env) !== 'off'
}

// ---------- 工具 ----------
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const nowText = () => new Date().toISOString().slice(0, 19).replace('T', ' ')
const ok = (data: any = null, message = '操作成功') => ({ code: 2000, message, data: data ?? null })
const fail = (msg: string, code = 4000) => ({ code, msg, data: null })

// ---------- 内存数据集（从 mock/*.json 载入，模块内可变，刷新页面即还原） ----------
const state = {
  users: clone(usersData) as any[],
  roles: clone(rolesData) as any[],
  menus: clone(menusData) as any[],
  operations: clone(operationsData) as any[],
  menuStatus: clone(menuStatusData) as any[],
  importHistory: clone(importHistoryData) as any[],
  ports: clone(portsData) as any[],
  // 角色 -> 菜单/操作授权（初始与 default.sql 种子等价：两个角色均可见已存在的 6 个菜单）
  roleMenus: new Map<number, number[]>(),
  roleOps: new Map<number, number[]>(),
}

function initAuthState() {
  const menuIds = state.menus.map(m => m.menu_id)
  state.roleMenus.set(1, clone(menuIds))
  state.roleMenus.set(16, clone(menuIds))
  // 管理员拥有全部操作；观赏角色没有操作权限（与 default.sql 种子一致）
  state.roleOps.set(1, state.operations.map(op => op.operation_id))
  state.roleOps.set(16, [])
}
initAuthState()

/** 恢复默认（refresh_default）：把内存数据还原为 mock/*.json 初始值 */
function resetState() {
  state.users = clone(usersData)
  state.roles = clone(rolesData)
  state.menus = clone(menusData)
  state.operations = clone(operationsData)
  state.menuStatus = clone(menuStatusData)
  state.importHistory = clone(importHistoryData)
  state.ports = clone(portsData)
  state.roleMenus.clear()
  state.roleOps.clear()
  initAuthState()
}

/** 默认列模板（与后端 DEFAULT_ROLE_COLUMNS 一致，用于未配置列模板的菜单） */
const DEFAULT_COLUMNS = [
  { colKey: 'index', title: '序号', width: 80, align: 'center', fixed: 'left', visible: true, displayIndex: 0 },
  { colKey: 'role_name', title: '权限名称', width: 170, align: 'center', visible: true, displayIndex: 1 },
  { colKey: 'role_unit', title: '归属单位', width: 170, align: 'center', visible: true, displayIndex: 2 },
  { colKey: 'role_dept', title: '归属部门', width: 170, align: 'center', visible: true, displayIndex: 3 },
  { colKey: 'role_desc', title: '备注', width: 180, align: 'center', visible: true, displayIndex: 4 },
  { colKey: 'actions', title: '操作', width: 260, align: 'center', fixed: 'right', visible: true, displayIndex: 5 },
]

// ---------- 通用查询 ----------
type SearchParams = { ep?: Record<string, any>; paging?: any; cdList?: any[] }

/** 简易分页：ep 模糊过滤 + 排序 + 分页，返回后端分页结构 */
function paginate(list: any[], searchForm: SearchParams = {}) {
  const { ep = {}, paging = {}, cdList = [] } = searchForm || {}
  const pageNumber = Math.max(1, Number(paging?.pageNumber) || 1)
  const pageSize = Math.max(1, Number(paging?.pageSize) || 10)
  const sortField: string = paging?.sortField || 'created_at'
  const sortDirection = String(paging?.sortDirection || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

  let rows = clone(list)
  // ep 条件（字段包含匹配，同后端 Like）
  Object.keys(ep).forEach(key => {
    const val = ep[key]
    if (val === undefined || val === null || val === '') return
    rows = rows.filter((row: any) => String(row[key] ?? '').includes(String(val)))
  })
  // cdList 简化为：INCLUDE / EQ 等常用条件
  if (Array.isArray(cdList) && cdList.length > 0) {
    rows = rows.filter((row: any) =>
      cdList.every((item: any) => {
        if (!item?.fieldName || item.fieldValue === undefined || item.fieldValue === null || item.fieldValue === '') return true
        const cell = String(row[item.fieldName] ?? '')
        const v = String(item.fieldValue)
        switch (item.operation) {
          case 'EQ': return cell === v
          case 'NE': return cell !== v
          case 'GT': return Number(cell) > Number(v)
          case 'LT': return Number(cell) < Number(v)
          case 'GE': return Number(cell) >= Number(v)
          case 'LE': return Number(cell) <= Number(v)
          case 'STARTWITH': return cell.startsWith(v)
          case 'ENDWITH': return cell.endsWith(v)
          case 'NOTINCLUDE': return !cell.includes(v)
          case 'INCLUDE':
          default: return cell.includes(v)
        }
      }),
    )
  }
  // 排序
  rows.sort((a: any, b: any) => {
    const av = a[sortField] ?? ''
    const bv = b[sortField] ?? ''
    const cmp = String(av).localeCompare(String(bv), 'zh-CN')
    return sortDirection === 'asc' ? cmp : -cmp
  })
  const total = rows.length
  return { data: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), total, pageNumber, pageSize }
}

/** 组装菜单树（按 parent_id -> children） */
function buildMenuTree(rows: any[], parentId: number | null = 0): any[] {
  return rows
    .filter(m => (m.parent_id ?? 0) === parentId)
    .sort((a, b) => (a.menu_sort ?? 0) - (b.menu_sort ?? 0))
    .map(m => {
      const children = buildMenuTree(rows, m.menu_id)
      const node: any = { ...clone(m), operationChildren: state.operations.filter(op => op.menu_id === m.menu_id) }
      if (children.length) node.children = children
      return node
    })
}

/** 登录/刷新 token 返回的用户信息（含权限菜单树） */
function buildUserSession(user: any) {
  const allowedMenuIds = state.roleMenus.get(user.role_id) || []
  const allowedMenus = state.menus.filter(m => allowedMenuIds.includes(m.menu_id))
  const menuList = buildMenuTree(allowedMenus)
  return {
    data: {
      user_id: user.user_id,
      username: user.username,
      role_name: user.role_name,
      email: user.email,
      menu_list: menuList,
    },
    token: 'Bearer mock-token-' + user.user_id,
  }
}

/** 从 localStorage 取当前登录用户（没有则回退到 admin） */
function currentUser(): any {
  try {
    const saved = JSON.parse(localStorage.getItem('userInfo') || '{}')
    if (saved && saved.user_id) {
      const u = state.users.find(x => x.user_id === Number(saved.user_id))
      if (u) return u
    }
  } catch { /* ignore */ }
  return state.users.find(x => x.account === 'admin') || state.users[0]
}

/** 用户列表返回给表格前移除敏感/多余列可保留，这里仅隐藏空密码展示用途 */
function publicUser(u: any) {
  const { password, ...rest } = u
  return { ...rest, password: '' }
}

// ---------- 菜单树分页（模拟后端 treePagination） ----------
function menuTreePage(searchForm: SearchParams) {
  const { ep = {}, paging = {} } = searchForm || {}
  const pageNumber = Math.max(1, Number(paging?.pageNumber) || 1)
  const pageSize = Math.max(1, Number(paging?.pageSize) || 10)

  let rows = clone(state.menus)
  const hasEp = Object.keys(ep).some(k => ep[k] !== undefined && ep[k] !== null && ep[k] !== '')
  if (hasEp) {
    const matched = new Set<number>()
    const byId = new Map(rows.map(m => [m.menu_id, m]))
    const hit = (row: any) =>
      Object.keys(ep).every(k => {
        const v = ep[k]
        return v === undefined || v === null || v === '' || String(row[k] ?? '').includes(String(v))
      })
    const matchedRows = rows.filter(hit)
    const collectAncestors = (id: number | null) => {
      if (id === null || id === undefined || matched.has(id)) return
      matched.add(id)
      const parent = byId.get(id)?.parent_id ?? null
      if (parent) collectAncestors(parent)
    }
    matchedRows.forEach(r => collectAncestors(r.menu_id))
    rows = rows.filter(r => matched.has(r.menu_id))
  }

  // 挂载操作并建树
  rows = rows.map((m: any) => ({ ...m, operationChildren: state.operations.filter(op => op.menu_id === m.menu_id) }))
  const roots = buildMenuTree(rows)
  const total = roots.length
  const start = (pageNumber - 1) * pageSize
  return { data: roots.slice(start, start + pageSize), total, pageNumber, pageSize }
}

/** 当前登录用户可见的列模板菜单 id 列表 */
function authMenuIds(user: any): number[] {
  const ids = state.roleMenus.get(user?.role_id) || []
  return state.menus.filter(m => ids.includes(m.menu_id)).map(m => m.menu_id)
}

// ============================================================
// Mock 路由注册表
// ============================================================

type MockCtx = {
  path: string
  method: string
  query: Record<string, any>
  body: any
  m?: RegExpMatchArray
}

type MockHandler = (ctx: MockCtx) => any

type MockRoute = {
  method: string
  pattern: RegExp
  handler: MockHandler
}

const routes: MockRoute[] = []

/** 便捷注册 */
const route = (method: string, pattern: RegExp, handler: MockHandler) => {
  routes.push({ method, pattern, handler })
}

function matchAll(r: RegExp, path: string): RegExpMatchArray | null {
  const m = path.match(r)
  return m
}

// ---------- 登录 / Token ----------
route('POST', /^hippoadmin\/common\/login$/, ({ body }) => {
  const { username, password } = body || {}
  const user = state.users.find(u => u.account === username || u.username === username)
  if (!user || password !== '123456') return fail('用户名或密码错误')
  return ok(buildUserSession(user), '登录成功')
})

route('POST', /^hippoadmin\/common\/refresh_token$/, () => {
  const user = currentUser()
  if (!user) return fail('请先登录', 4001)
  return ok(buildUserSession(user), 'Token刷新成功')
})

route('POST', /^hippoadmin\/common\/refresh_default$/, () => {
  resetState()
  return ok({ success: true }, '数据库已恢复默认状态')
})

// ---------- 用户 ----------
route('GET', /^hippoadmin\/user\/list$/, ({ query }) =>
  ok(paginate(state.users.map(publicUser), query)),
)

route('POST', /^hippoadmin\/user\/add$/, ({ body }) => {
  if (state.users.some(u => u.account === body?.account)) return fail('账号已存在')
  const role = state.roles.find(r => r.role_id === Number(body?.role_id))
  const nextId = Math.max(0, ...state.users.map(u => u.user_id)) + 1
  const row = {
    user_id: nextId,
    account: body?.account ?? '',
    password: '',
    username: body?.username ?? '',
    email: body?.email ?? '',
    phone_number: body?.phone_number ?? '',
    role_id: Number(body?.role_id) || 1,
    role_name: body?.role_name ?? role?.role_name ?? '管理员',
    gender: Number(body?.gender) || 0,
    created_at: nowText(),
    updated_at: nowText(),
  }
  state.users.unshift(row)
  return ok(row)
})

route('GET', /^hippoadmin\/user\/(\d+)\/info$/, ({ m }) => {
  const user = state.users.find(u => u.user_id === Number(m![1]))
  return ok(user ? publicUser(user) : null)
})

route('POST', /^hippoadmin\/user\/(\d+)\/changePassword$/, ({ m, body }) => {
  const user = state.users.find(u => u.user_id === Number(m![1]))
  if (!user) return ok(null, '用户不存在')
  if (body?.oldPassword !== '123456') return ok(null, '旧密码错误')
  if (body?.newPassword !== body?.confirmPassword) return ok(null, '确认密码与新密码不一致')
  return ok(null, '修改密码成功')
})

route('POST', /^hippoadmin\/user\/(\d+)\/update$/, ({ m, body }) => {
  const idx = state.users.findIndex(u => u.user_id === Number(m![1]))
  if (idx < 0) return fail('用户不存在')
  const role = state.roles.find(r => r.role_id === Number(body?.role_id))
  state.users[idx] = {
    ...state.users[idx],
    ...body,
    password: state.users[idx].password,
    role_name: body?.role_name ?? role?.role_name ?? state.users[idx].role_name,
    updated_at: nowText(),
  }
  return ok({ data: { affected: 1, raw: {} } }, '用户信息修改成功')
})

route('POST', /^hippoadmin\/user\/(\d+)\/delete$/, ({ m }) => {
  const id = Number(m![1])
  if (!state.users.some(u => u.user_id === id)) return fail('用户不存在')
  state.users = state.users.filter(u => u.user_id !== id)
  return ok(null, '用户删除成功')
})

// ---------- 角色 ----------
route('GET', /^hippoadmin\/role\/list$/, ({ query }) => ok(paginate(state.roles, query)))

route('POST', /^hippoadmin\/role\/add$/, ({ body }) => {
  const nextId = Math.max(0, ...state.roles.map(r => r.role_id)) + 1
  const row = {
    role_id: nextId,
    role_name: body?.role_name ?? '',
    role_unit: body?.role_unit ?? '',
    role_dept: body?.role_dept ?? '',
    role_desc: body?.role_desc ?? '',
    created_at: nowText(),
    updated_at: nowText(),
  }
  state.roles.push(row)
  state.roleMenus.set(nextId, [])
  state.roleOps.set(nextId, [])
  return ok(row)
})

route('GET', /^hippoadmin\/role\/(\d+)$/, ({ m }) => {
  const role = state.roles.find(r => r.role_id === Number(m![1]))
  return ok(role ?? null)
})

route('POST', /^hippoadmin\/role\/update\/(\d+)$/, ({ m, body }) => {
  const idx = state.roles.findIndex(r => r.role_id === Number(m![1]))
  if (idx < 0) return fail('角色不存在')
  state.roles[idx] = { ...state.roles[idx], ...body, updated_at: nowText() }
  return ok({ affected: 1, raw: {} })
})

route('POST', /^hippoadmin\/role\/delete\/(\d+)$/, ({ m }) => {
  const id = Number(m![1])
  if (!state.roles.some(r => r.role_id === id)) return fail('角色ID不能为空')
  state.roles = state.roles.filter(r => r.role_id !== id)
  state.roleMenus.delete(id)
  state.roleOps.delete(id)
  return ok({ affected: 1, raw: {} })
})

route('GET', /^hippoadmin\/role\/auth\/(\d+)$/, ({ m }) => {
  const roleId = Number(m![1])
  const menus = authMenuIds({ role_id: roleId })
  const ops = state.roleOps.get(roleId) || []
  return ok({ menuIds: menus, operationIds: ops })
})

route('POST', /^hippoadmin\/role\/auth\/config\/(\d+)$/, ({ m, body }) => {
  const roleId = Number(m![1])
  state.roleMenus.set(roleId, Array.isArray(body?.menuIds) ? body.menuIds : [])
  state.roleOps.set(roleId, Array.isArray(body?.operationIds) ? body.operationIds : [])
  return ok(null, '权限配置成功')
})

// ---------- 菜单 ----------
route('GET', /^hippoadmin\/menu\/list$/, ({ query }) => ok(menuTreePage(query)))

route('POST', /^hippoadmin\/menu\/addMenu$/, ({ body }) => {
  if (Number(body?.menu_type) !== 0 && !state.menus.some(m => m.menu_id === Number(body?.parent_id))) {
    return fail('父级菜单不存在,请刷新后重试')
  }
  const nextId = Math.max(0, ...state.menus.map(m => m.menu_id)) + 1
  const row = {
    menu_id: nextId,
    menu_name: body?.menu_name ?? '',
    menu_icon: body?.menu_icon ?? '',
    table_name: null,
    component_name: body?.component_name ?? null,
    component_address: body?.component_address ?? null,
    menu_type: Number(body?.menu_type) || 0,
    is_cached: body?.is_cached === false ? 0 : 1,
    is_show: body?.is_show === false ? 0 : 1,
    parent_id: Number(body?.parent_id) || 0,
    menu_remark: body?.menu_remark ?? null,
    menu_sort: Math.max(0, ...state.menus.filter(m => m.parent_id === (Number(body?.parent_id) || 0)).map(m => m.menu_sort)) + 1,
    created_at: nowText(),
    updated_at: nowText(),
  }
  state.menus.push(row)
  return ok({ data: row }, '菜单添加成功')
})

route('GET', /^hippoadmin\/menu\/delete$/, ({ query }) => {
  const id = Number(query?.menuId)
  const menu = state.menus.find(m => m.menu_id === id)
  if (!menu) return fail('菜单不存在,请刷新后重试')
  // 目录删除时级联删除子级
  const removeIds = new Set<number>()
  const collect = (pid: number) => {
    state.menus.filter(m => m.parent_id === pid).forEach(child => {
      removeIds.add(child.menu_id)
      collect(child.menu_id)
    })
  }
  removeIds.add(id)
  collect(id)
  state.menus = state.menus.filter(m => !removeIds.has(m.menu_id))
  state.operations = state.operations.filter(op => !removeIds.has(op.menu_id))
  return ok(null, '菜单删除成功')
})

route('POST', /^hippoadmin\/menu\/updateMenu$/, ({ body }) => {
  const menuId = Number(body?.menu_id)
  if (!state.menus.some(m => m.menu_id === menuId)) return fail('菜单不存在,请刷新后重试')
  const { children, operationChildren, ...fields } = body || {}
  state.menus = state.menus.map(m => (m.menu_id === menuId ? { ...m, ...fields, updated_at: nowText() } : m))
  return ok({ data: fields }, '菜单修改成功')
})

route('GET', /^hippoadmin\/menu\/getMenuById$/, ({ query }) => {
  const menu = state.menus.find(m => m.menu_id === Number(query?.menuId))
  if (!menu) return fail('菜单不存在,请刷新后重试')
  return ok(menu)
})

route('GET', /^hippoadmin\/menu\/options\/(\d+)$/, ({ m }) => {
  const user = state.users.find(u => u.user_id === Number(m![1])) || currentUser()
  const allowedMenuIds = state.roleMenus.get(user?.role_id) || []
  const allowed = state.menus.filter(menu => allowedMenuIds.includes(menu.menu_id))
  const tree = buildMenuTree(allowed)
  // 与后端一致：只保留带 table_name 的叶子，或包含有效叶子的目录
  const filterTree = (nodes: any[]): any[] => {
    const result: any[] = []
    for (const node of nodes) {
      const hasTable = !!node.table_name
      const isDirectory = Number(node.menu_type) === 0
      const validChildren = node.children ? filterTree(node.children) : []
      if (hasTable) {
        node.children = validChildren
        result.push(node)
      } else if (isDirectory && validChildren.length > 0) {
        node.children = validChildren
        result.push(node)
      }
    }
    return result
  }
  return ok(filterTree(tree))
})

// ---------- 列模板（menu/status） ----------
route('GET', /^hippoadmin\/menu\/status\/list$/, ({ query }) => {
  const rows = clone(state.menuStatus).map(item => ({
    ...item,
    column_config: [...(item.column_config || [])].sort((a, b) => a.displayIndex - b.displayIndex),
  }))
  return ok(paginate(rows, query))
})

route('GET', /^hippoadmin\/menu\/status\/(\d+)$/, ({ m }) => {
  const menuId = Number(m![1])
  const found = state.menuStatus.find(s => s.menu_id === menuId)
  if (!found || !found.column_config?.length) {
    return ok({
      menu_id: menuId,
      menu_name: found?.menu_name ?? null,
      column_config: clone(DEFAULT_COLUMNS),
      is_default: true,
    })
  }
  const sorted = [...clone(found.column_config)].sort((a, b) => a.displayIndex - b.displayIndex).filter(c => c.visible)
  return ok({
    menu_status_id: found.menu_status_id,
    menu_id: menuId,
    menu_name: found.menu_name,
    column_config: sorted,
    is_default: false,
  })
})

route('POST', /^hippoadmin\/menu\/status\/save$/, ({ body }) => {
  const menuId = Number(body?.menu_id)
  const existing = state.menuStatus.find(s => s.menu_id === menuId)
  if (existing) return ok({ data: existing }, '该菜单已有列模板配置，请使用更新接口')
  const menu = state.menus.find(m => m.menu_id === menuId)
  if (!menu) return fail('菜单不存在，请刷新后重试')
  const row = {
    menu_status_id: Math.max(0, ...state.menuStatus.map(s => s.menu_status_id)) + 1,
    menu_id: menuId,
    menu_name: menu.menu_name,
    column_config: body?.column_config ?? clone(DEFAULT_COLUMNS),
    created_at: nowText(),
    updated_at: nowText(),
  }
  state.menuStatus.push(row)
  return ok({ data: row }, '列模板创建成功')
})

route('POST', /^hippoadmin\/menu\/status\/update\/(\d+)$/, ({ m, body }) => {
  const idx = state.menuStatus.findIndex(s => s.menu_status_id === Number(m![1]))
  if (idx < 0) return fail('列模板配置不存在，请刷新后重试')
  const sortedConfig = [...(body?.column_config || [])].sort((a, b) => a.displayIndex - b.displayIndex)
  state.menuStatus[idx] = { ...state.menuStatus[idx], column_config: sortedConfig, updated_at: nowText() }
  return ok(
    { data: { menu_status_id: state.menuStatus[idx].menu_status_id, menu_name: state.menuStatus[idx].menu_name, column_config: sortedConfig } },
    '列模板更新成功',
  )
})

route('POST', /^hippoadmin\/menu\/status\/delete\/(\d+)$/, ({ m }) => {
  const id = Number(m![1])
  if (!state.menuStatus.some(s => s.menu_status_id === id)) return fail('列模板配置不存在，请刷新后重试')
  state.menuStatus = state.menuStatus.filter(s => s.menu_status_id !== id)
  return ok(null, '列模板配置已删除，将恢复默认列配置')
})

// ---------- 操作 / 接口 ----------
route('GET', /^hippoadmin\/menu\/getOperationList$/, ({ query }) => {
  const list = state.operations.filter(op => op.menu_id === Number(query?.menuId))
  return ok({ data: list, total: list.length })
})

route('POST', /^hippoadmin\/menu\/addOperation$/, ({ body }) => {
  const nextId = Math.max(0, ...state.operations.map(op => op.operation_id)) + 1
  const op = {
    operation_id: nextId,
    operation_name: body?.operation_name ?? '',
    operation_sign: body?.operation_sign ?? '',
    operation_port: body?.operation_port ?? '',
    operation_method: body?.operation_method ?? '',
    menu_id: Number(body?.menu_id) || 0,
    created_at: nowText(),
    updated_at: nowText(),
  }
  state.operations.push(op)
  // 新操作默认授权给管理员
  const adminOps = state.roleOps.get(1) || []
  if (!adminOps.includes(nextId)) state.roleOps.set(1, [...adminOps, nextId])
  return ok({ data: op }, '操作添加成功')
})

route('GET', /^hippoadmin\/menu\/deleteOperation$/, ({ query }) => {
  const id = Number(query?.operationId)
  if (!state.operations.some(op => op.operation_id === id)) return fail('操作不存在，请刷新后重试')
  state.operations = state.operations.filter(op => op.operation_id !== id)
  return ok(null, '操作删除成功')
})

route('GET', /^hippoadmin\/port\/all$/, () => ok(clone(state.ports)))

// ---------- Excel 导入 ----------
/** 从 FormData 中取文件列表 */
function filesFromForm(form: FormData): File[] {
  const list: File[] = []
  if (!form) return list
  const collect = (key: string) => {
    const values = form.getAll(key)
    values.forEach(v => { if (v instanceof File) list.push(v) })
  }
  collect('file')
  collect('files')
  if (list.length === 0) {
    const one = form.get('file')
    if (one instanceof File) list.push(one)
  }
  return list
}

/** 读取 Excel 数据行数（表头之外的数据行），读不了就按 0 处理 */
async function countExcelRows(file: File): Promise<number> {
  try {
    const { read, utils } = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) return 0
    const json = utils.sheet_to_json(sheet, { defval: '' })
    return Math.max(0, json.length)
  } catch {
    return 0
  }
}

route('POST', /^hippoadmin\/excel\/import\/(\d+)$/, async ({ m, body }) => {
  const menuId = Number(m![1])
  const menu = state.menus.find(x => x.menu_id === menuId)
  const files = filesFromForm(body as FormData)
  const file = files[0]
  const total = file ? await countExcelRows(file) : 0
  if (file && total > 0) {
    state.importHistory.unshift({
      import_history_id: Math.max(0, ...state.importHistory.map(h => h.import_history_id)) + 1,
      import_menu_name: menu?.menu_name ?? '',
      import_time: nowText(),
      import_file_name: file.name,
      import_total: total,
    })
  }
  return ok({ total, success: total, failed: 0, skipped: 0, errors: [] }, '导入完成')
})

route('POST', /^hippoadmin\/excel\/batch-import$/, async ({ body }) => {
  const files = filesFromForm(body as FormData)
  const results: any[] = []
  for (const file of files) {
    const baseName = (file.name || '').replace(/\.(xlsx|xls|csv)$/i, '')
    const menu = state.menus.find(x => x.menu_name === baseName && Number(x.menu_type) === 1 && x.table_name)
    const total = await countExcelRows(file)
    if (!menu) {
      results.push({ fileName: baseName, tableName: '', total: 0, success: 0, failed: 0, errors: [`未匹配到菜单「${baseName}」`] })
      continue
    }
    state.importHistory.unshift({
      import_history_id: Math.max(0, ...state.importHistory.map(h => h.import_history_id)) + 1,
      import_menu_name: menu.menu_name,
      import_time: nowText(),
      import_file_name: file.name,
      import_total: total,
    })
    results.push({ fileName: baseName, tableName: menu.table_name, total, success: total, failed: 0, skipped: 0, errors: [] })
  }
  return ok({ results })
})

route('GET', /^hippoadmin\/excel\/importhistory\/list$/, ({ query }) => ok(paginate(state.importHistory, query)))

route('GET', /^hippoadmin\/excel\/clearHistory$/, () => {
  state.importHistory = []
  return ok(null)
})

// ============================================================
// 对外入口
// ============================================================

export type MockRequestConfig = {
  url?: string
  method?: string
  params?: any
  data?: any
}

/** 命中 Mock 路由则返回“伪 axios 响应”，未命中返回 null */
export function handleMockRequest(config: MockRequestConfig): Promise<any> | null {
  const rawUrl = (config?.url || '').split('?')[0].replace(/^\/+/, '')
  const method = String(config?.method || 'get').toUpperCase()

  // 额外从 url query 提取的参数（一般 axios 都放在 config.params，这里做兜底）
  const query = { ...(config?.params || {}) }
  const urlQuery = (config?.url || '').split('?')[1]
  if (urlQuery) {
    new URLSearchParams(urlQuery).forEach((v, k) => { query[k] = v })
  }

  let body = config?.data
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { /* not json */ }
  }

  for (const r of routes) {
    if (r.method !== method) continue
    const m = matchAll(r.pattern, rawUrl)
    if (!m) continue
    console.info(`[mock] 使用本地 Mock：${method} /${rawUrl}`)
    return Promise.resolve(r.handler({ path: rawUrl, method, query, body, m })).then(data =>
      wait(120).then(() => ({
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config as any,
      })),
    )
  }
  return null
}

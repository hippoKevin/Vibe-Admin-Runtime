#!/usr/bin/env node

'use strict';

/**
 * 通过接口创建「系统运维」的目录 / 菜单 / 菜单配置
 *
 * 背景：
 *   系统运维页面（src/pages/SystemOps/index.vue）需要通过菜单才能打开，
 *   而菜单是数据库数据，这里直接调用后端接口创建，避免手抄 SQL。
 *
 * 用法：
 *   node QuickStart/create_system_ops_menu.js --username 账号 --password 密码
 *
 * 可选参数：
 *   --base        接口地址，默认 http://127.0.0.1:5004
 *   --dir-name    目录名称，默认「系统运维」
 *   --menu-name   菜单名称，默认「系统运维」
 *   --parent      已有的父级目录 id（填了就不再新建目录，直接挂到该目录下）
 *   --grant-role  给指定角色 id 授权（会先读取现有权限再合并，不会覆盖原有权限）
 *   --dry-run     只打印将要创建的请求，不实际写入
 *
 * 说明：
 *   脚本可重复执行：已存在的目录 / 菜单会直接复用，不会重复创建。
 */

// ==========================
// 常量
// ==========================

const BASE_DEFAULT = 'http://127.0.0.1:5004';

/** 与菜单管理里填写的一致：组件名称 + 组件地址 */
const COMPONENT_NAME = 'SystemOpsPage';
const COMPONENT_ADDRESS = '/src/pages/SystemOps/index.vue';

const LINE = '='.repeat(64);


// ==========================
// 参数解析
// ==========================

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const [key, inlineValue] = token.slice(2).split('=');
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}


// ==========================
// 请求封装
// ==========================

let BASE = BASE_DEFAULT;
let TOKEN = '';

async function request(method, path, options = {}) {
  const url = new URL(BASE + path);

  for (const [key, value] of Object.entries(options.params || {})) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }

  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = TOKEN;

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { raw: text };
  }

  return { status: response.status, json };
}

/** 解析 JWT 载荷（只用于打印诊断信息，不做校验） */
function decodeTokenPayload() {
  try {
    const pure = String(TOKEN).replace(/^Bearer\s+/i, '');
    const payload = pure.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
  } catch (e) {
    return null;
  }
}

/** 调用接口并校验业务码，返回 data */
async function callApi(method, path, options, label) {
  const { status, json } = await request(method, path, options);

  // NestJS 的 POST 默认返回 201 Created，所以这里只判断是否 2xx
  if (status < 200 || status >= 300) {
    const message = json?.message || json?.msg || json?.raw || `HTTP ${status}`;
    throw new Error(`${label}失败：${message}（HTTP ${status}）`);
  }

  // 业务错误（BusinessException）固定返回 HTTP 200 + 业务码，需要单独判断
  if (json?.code !== 2000) {
    const message = json?.message || json?.msg || `业务码 ${json?.code}`;

    // 4003 = 当前角色没有该 operation_code 权限，这里直接打印诊断信息
    if (json?.code === 4003) {
      const payload = decodeTokenPayload();
      console.warn(`[诊断] token 载荷：${JSON.stringify(payload)}`);
      console.warn('[诊断] 4003 表示当前角色的 role_operation 里没有这个操作权限（operation_code）');
      if (payload && typeof payload.role_id !== 'number') {
        console.warn('[诊断] 但 role_id 不是数字，说明后端登录接口把 user.role_name（角色名）写进了 role_id，');
        console.warn('[诊断] 权限校验用 role_operation.role_id 匹配，永远匹配不到 → 所有带权限的接口都报 4003');
        console.warn('[诊断] 修复：common.service.ts 登录处改为 role_id: user.role_id，重启后端并重新登录');
      }
    }

    throw new Error(`${label}失败：${message}（code ${json?.code}）`);
  }

  return json.data;
}


// ==========================
// 工具方法
// ==========================

/** 菜单树拍平 */
function flattenMenus(list, result = []) {
  for (const item of list || []) {
    result.push(item);
    if (item.children?.length) flattenMenus(item.children, result);
  }
  return result;
}

/**
 * 后端 addMenu / saveMenuStatus 返回的是 { data, message }，
 * 经过全局拦截器后会变成 data.data，这里两种结构都兼容
 */
function unwrapEntity(payload) {
  if (!payload) return null;
  if (payload.menu_id) return payload;
  if (payload.data?.menu_id) return payload.data;
  return null;
}


// ==========================
// 主流程
// ==========================

async function main() {
  const args = parseArgs(process.argv.slice(2));

  BASE = String(args.base || BASE_DEFAULT).replace(/\/+$/, '');

  const username = args.username;
  const password = args.password;
  const dirName = String(args['dir-name'] || '系统运维');
  const menuName = String(args['menu-name'] || '系统运维');
  const grantRole = args['grant-role'] ? Number(args['grant-role']) : null;
  const parentId = args.parent ? Number(args.parent) : null;
  const dryRun = Boolean(args['dry-run']);

  if (!username || !password) {
    console.error('缺少登录账号：请使用 --username 账号 --password 密码');
    process.exit(1);
  }

  console.log(LINE);
  console.log(' 通过接口创建「系统运维」目录 / 菜单 / 菜单配置');
  console.log(LINE);
  console.log(`[Create] 接口地址   ${BASE}`);
  console.log(`[Create] 目录名称   ${dirName}${parentId ? `（挂到已有目录 ${parentId} 下）` : ''}`);
  console.log(`[Create] 菜单名称   ${menuName}`);
  console.log(`[Create] 组件名称   ${COMPONENT_NAME}`);
  console.log(`[Create] 组件地址   ${COMPONENT_ADDRESS}`);
  if (grantRole) console.log(`[Create] 授权角色   ${grantRole}`);
  if (dryRun) console.log('[Create] 当前为预览模式（--dry-run），不会写入数据');
  console.log('');

  // ---------- 1. 登录 ----------
  console.log('[1/5] 登录中...');
  const loginData = await callApi(
    'POST',
    '/hippoadmin/common/login',
    { body: { username, password } },
    '登录'
  );
  TOKEN = loginData?.token || loginData?.data?.token || '';
  if (!TOKEN) throw new Error(`登录成功但没有拿到 token：${JSON.stringify(loginData)}`);
  console.log('[1/5] 登录成功\n');

  // ---------- 2. 查询已有菜单（幂等判断） ----------
  console.log('[2/5] 读取现有菜单...');
  let menus = [];

  try {
    const menuPage = await callApi(
      'GET',
      '/hippoadmin/menu/list',
      {
        params: {
          'ep[moldInfo]': '',
          'paging[pageNumber]': 1,
          'paging[pageSize]': 1000
        }
      },
      '获取菜单列表'
    );
    menus = flattenMenus(menuPage?.data || []);
    console.log(`[2/5] 共 ${menus.length} 条菜单\n`);
  } catch (error) {
    // 查询失败不阻断创建，只是失去“重复校验”能力
    console.warn(`[2/5] 读取菜单列表失败（${error.message}），跳过重复校验继续创建\n`);
  }

  let directory = parentId
    ? menus.find((item) => Number(item.menu_id) === parentId)
    : menus.find((item) => item.menu_name === dirName && Number(item.menu_type) === 0);

  let menu =
    menus.find((item) => item.component_name === COMPONENT_NAME) ||
    menus.find((item) => item.menu_name === menuName && Number(item.menu_type) === 1);

  // ---------- 3. 目录 ----------
  console.log('[3/5] 目录...');
  let directoryId;

  if (parentId) {
    directoryId = parentId;
    console.log(`[3/5] 使用已有目录 ${directoryId}${directory ? `（${directory.menu_name}）` : ''}\n`);
  } else if (directory) {
    directoryId = directory.menu_id;
    console.log(`[3/5] 目录已存在，复用 menu_id=${directoryId}\n`);
  } else if (dryRun) {
    directoryId = 0;
    console.log(`[3/5] 将创建目录「${dirName}」（预览）\n`);
  } else {
    const created = await callApi(
      'POST',
      '/hippoadmin/menu/addMenu',
      {
        body: {
          menu_name: dirName,
          menu_icon: 'server',
          menu_type: 0,
          parent_id: 0,
          is_cached: true,
          is_show: true,
          menu_remark: '系统运维目录'
        }
      },
      '创建目录'
    );

    const entity = unwrapEntity(created);
    directoryId = entity?.menu_id;
    if (!directoryId) throw new Error(`创建目录成功但未返回 menu_id：${JSON.stringify(created)}`);
    console.log(`[3/5] 目录创建成功 menu_id=${directoryId}\n`);
  }

  // ---------- 4. 菜单 ----------
  console.log('[4/5] 菜单...');
  let menuId;

  if (menu) {
    menuId = menu.menu_id;
    console.log(`[4/5] 菜单已存在，复用 menu_id=${menuId}\n`);
  } else if (dryRun) {
    menuId = 0;
    console.log(`[4/5] 将创建菜单「${menuName}」（预览）\n`);
  } else {
    const created = await callApi(
      'POST',
      '/hippoadmin/menu/addMenu',
      {
        body: {
          menu_name: menuName,
          menu_icon: 'server',
          component_name: COMPONENT_NAME,
          component_address: COMPONENT_ADDRESS,
          menu_type: 1,
          parent_id: directoryId,
          is_cached: true,
          is_show: true,
          menu_remark: '系统运维：关于系统、系统日志、环境配置'
        }
      },
      '创建菜单'
    );

    const entity = unwrapEntity(created);
    menuId = entity?.menu_id;
    if (!menuId) throw new Error(`创建菜单成功但未返回 menu_id：${JSON.stringify(created)}`);
    console.log(`[4/5] 菜单创建成功 menu_id=${menuId}\n`);
  }

  // ---------- 5. 菜单配置 ----------
  console.log('[5/5] 菜单配置...');
  if (dryRun) {
    console.log('[5/5] 将创建菜单配置（预览）\n');
  } else {
    // 系统运维页面没有表格，列模板留空即可；需要时可在「菜单配置」里再改
    await callApi(
      'POST',
      '/hippoadmin/menu/status/save',
      { body: { menu_id: menuId, column_config: [] } },
      '创建菜单配置'
    );
    console.log('[5/5] 菜单配置创建成功\n');
  }

  // ---------- 可选：给角色授权 ----------
  if (grantRole) {
    try {
      console.log(`[授权] 读取角色 ${grantRole} 现有权限...`);
      const auth = await callApi('GET', `/hippoadmin/role/auth/${grantRole}`, {}, '读取角色权限');

      const menuIds = Array.from(new Set([...(auth?.menuIds || []), directoryId, menuId]))
        .filter((id) => Number(id) > 0);
      const operationIds = auth?.operationIds || [];

      if (dryRun) {
        console.log(`[授权] 将提交 menuIds=${menuIds.join(',')}（预览）\n`);
      } else {
        await callApi(
          'POST',
          `/hippoadmin/role/auth/config/${grantRole}`,
          { body: { menuIds, operationIds } },
          '角色授权'
        );
        console.log(`[授权] 已给角色 ${grantRole} 追加菜单权限：${menuIds.join(',')}\n`);
      }
    } catch (error) {
      // 授权失败不影响目录 / 菜单 / 菜单配置的创建结果
      console.warn(`[授权] 授权失败：${error.message}`);
      console.warn('[授权] 可稍后到「角色管理」手动勾选该菜单\n');
    }
  }

  // ---------- 汇总 ----------
  console.log(LINE);
  console.log(' 完成');
  console.log(LINE);
  if (!dryRun) {
    console.log(` 目录 menu_id：${directoryId}`);
    console.log(` 菜单 menu_id：${menuId}`);
    console.log('');
    console.log(' 接下来：');
    console.log(' 1. 重启一次后端（SystemOpsModule 是新模块，重启后接口才存在）');
    console.log(' 2. 到「角色管理」给需要的角色勾上这个菜单（或用 --grant-role 参数自动授权）');
    console.log(' 3. 刷新页面，侧边栏即可看到「系统运维」');
  }
}


// ==========================
// 执行
// ==========================

main().catch((error) => {
  console.error('');
  console.error(`[Create] 执行失败：${error.message}`);
  process.exit(1);
});

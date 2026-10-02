#!/usr/bin/env node

'use strict';

/**
 * 登记「院校 AI 智能辅助」Demo 页面的菜单
 *
 * 背景：
 *   赛题 Demo 页面 ADMINCLIENT/src/pages/CampusAiDemo/index.vue 需要先有菜单，
 *   前端路由（src/router/addMenuRoutes.ts）才会按 component_name 注册 /CampusAiPage，
 *   「开发模式」运行中跟随 Agent 跳转也只能跳到「菜单里的页面」。
 *   菜单是数据库数据，这里直接调接口创建，避免手抄 SQL。
 *
 * 结构：
 *   院校 AI（目录，menu_type=0）
 *     └─ 院校 AI 智能辅助  /src/pages/CampusAiDemo/index.vue  CampusAiPage
 *
 * 用法：
 *   node QuickStart/create_campus_ai_menu.js --username 账号 --password 密码
 *
 * 可选参数：
 *   --base        接口地址，默认 http://127.0.0.1:5004
 *   --dir-name    目录名称，默认「院校 AI」
 *   --menu-name   菜单名称，默认「院校 AI 智能辅助」
 *   --parent      已有的父级目录 id（填了就不再新建目录，直接挂到该目录下）
 *   --grant-role  给指定角色授权（先读现有权限再合并，不会覆盖）
 *   --dry-run     只打印将要执行的操作
 *
 * 幂等：目录、菜单、菜单配置已存在时全部复用，不重复创建；
 *       也绝不修改任何已存在的菜单项。
 */

const BASE_DEFAULT = 'http://127.0.0.1:5004';

/** 当前接口地址（main 里按 --base 覆盖） */
let BASE = BASE_DEFAULT;

const DEFAULT_DIR_NAME = '院校 AI';
const DEFAULT_MENU_NAME = '院校 AI 智能辅助';

/** 目录图标：与「系统运维 / 智能管理」用同一套已验证可用的 tdesign 图标名 */
const DIR_ICON = 'server';
const MENU_ICON = 'ai';

/**
 * 与菜单管理里填写的一致：组件名称 + 组件地址（三者必须一致：菜单 / 路由 / 页面 name）
 *
 * 关于 `CampusAiPageNew` 这个后缀：
 *   前端 addMenuRoutes 用 `path: '/' + component_name` 注册路由，而 vue-router 4 的路径
 *   匹配默认 `sensitive: false`（vue-router.mjs 的 BASE_PATH_PARSER_OPTIONS），即
 *   `/CampusAiPage` 与 `/CampusAIPage` 会命中同一条路由。本仓库另有一页 CampusAIPage，
 *   所以这里用大小写唯一的组件名，避免打开链接时落到别人的页面上。
 *   若将来那一页改名或下线，可把这里与页面 `name` 一起改回 CampusAiPage。
 */
const COMPONENT_NAME = 'CampusAiPageNew';
const COMPONENT_ADDRESS = '/src/pages/CampusAiDemo/index.vue';

const LINE = '='.repeat(64);

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

/** 统一请求：返回 data，业务码不是 2000 就抛错 */
async function callApi(method, path, { body, params, token } = {}, action = path) {
    const url = new URL(BASE.replace(/\/$/, '') + path);
    for (const [key, value] of Object.entries(params || {})) {
        url.searchParams.set(key, String(value));
    }

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = token;

    let response;
    try {
        response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (error) {
        throw new Error(`${action}：请求失败（${error.message}），确认后端已启动在 ${BASE}`);
    }

    const text = await response.text();
    let json;
    try {
        json = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`${action}：返回内容不是 JSON（HTTP ${response.status}）`);
    }

    const okStatus = response.status >= 200 && response.status < 300;
    const okCode = json.code === undefined || json.code === 2000 || json.code === 200;

    if (!okStatus || !okCode) {
        const hint = json.code === 4003 ? '（当前账号缺少该操作权限，可先用 --grant-role 授权或换管理员账号）' : '';
        throw new Error(`${action}：${json.message || `HTTP ${response.status}`}${hint}`);
    }

    return json.data !== undefined ? json.data : json;
}

/** 菜单可能是树、也可能被包成 { total, data } 这种分页结构，统一拍平成数组 */
function flattenMenus(input) {
    const list = Array.isArray(input) ? input : input?.data || input?.list || input?.items || [];
    const result = [];

    const walk = (items) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
            result.push(item);
            walk(item.children || item.sub_menu || []);
        }
    };

    walk(list);
    return result;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    BASE = args.base || BASE_DEFAULT;
    const username = args.username || args.u;
    const password = args.password || args.p;
    const dirName = args['dir-name'] || DEFAULT_DIR_NAME;
    const menuName = args['menu-name'] || DEFAULT_MENU_NAME;
    const parentArg = args.parent ? Number(args.parent) : 0;
    const grantRole = args['grant-role'] ? String(args['grant-role']) : null;
    const dryRun = Boolean(args['dry-run']);

    if (!username || !password) {
        console.error('用法：node QuickStart/create_campus_ai_menu.js --username 账号 --password 密码 [--grant-role 1] [--dry-run]');
        process.exit(1);
    }

    console.log(LINE);
    console.log(' 登记「院校 AI 智能辅助」Demo 菜单');
    console.log(LINE);
    console.log(`[CampusAi] 接口地址 ${BASE}`);
    console.log(`[CampusAi] 目录     ${dirName}`);
    console.log(`[CampusAi] 菜单     ${menuName} -> ${COMPONENT_ADDRESS}（${COMPONENT_NAME}）`);
    console.log('');

    // ---------- 1. 登录 ----------
    const loginData = await callApi('POST', '/hippoadmin/common/login', { body: { username, password } }, '登录');
    const token = loginData?.token;
    if (!token) throw new Error('登录成功但未拿到 token');
    console.log('[1/4] 登录成功');

    // ---------- 2. 读菜单，判断目录/菜单是否已存在 ----------
    const menus = flattenMenus(await callApi('GET', '/hippoadmin/menu/list', { token }, '读取菜单'));
    console.log(`[2/4] 读取到 ${menus.length} 条菜单`);

    const existingMenu = menus.find((item) => item.component_name === COMPONENT_NAME);

    // 兼容手工/早期登记留下的旧组件名：只在「同一个 component_address」上改名，不动别人的菜单
    const legacyMenu = menus.find(
        (item) =>
            item.component_address === COMPONENT_ADDRESS &&
            item.component_name &&
            item.component_name !== COMPONENT_NAME
    );
    let directoryId = parentArg;

    // ---------- 3. 目录 ----------
    if (directoryId) {
        console.log(`[3/4] 使用 --parent 指定的父目录 menu_id=${directoryId}`);
    } else {
        const directory = menus.find((item) => item.menu_name === dirName && Number(item.parent_id) === 0);
        if (directory) {
            directoryId = directory.menu_id;
            console.log(`[3/4] 目录「${dirName}」已存在，复用 menu_id=${directoryId}`);
        } else if (dryRun) {
            console.log(`[3/4] 将创建目录「${dirName}」（预览）`);
        } else {
            const created = await callApi(
                'POST',
                '/hippoadmin/menu/addMenu',
                {
                    token,
                    body: {
                        menu_name: dirName,
                        menu_icon: DIR_ICON,
                        menu_type: 0,
                        parent_id: 0,
                        is_cached: true,
                        is_show: true,
                        menu_sort: 3,
                        menu_remark: `${dirName}目录（赛题 Demo）`,
                    },
                },
                '创建目录'
            );
            directoryId = created?.menu_id || created?.data?.menu_id;
            if (!directoryId) throw new Error('创建目录成功但未返回 menu_id');
            console.log(`[3/4] 目录「${dirName}」创建成功 menu_id=${directoryId}`);
        }
    }

    // ---------- 4. 菜单 + 菜单配置 ----------
    let menuId = existingMenu?.menu_id || 0;

    if (menuId) {
        console.log(`[4/4] 菜单已存在，复用 menu_id=${menuId}（不修改已有配置）`);
    } else if (legacyMenu && dryRun) {
        console.log(`[4/4] 将把 menu_id=${legacyMenu.menu_id} 的组件名从 ${legacyMenu.component_name} 改为 ${COMPONENT_NAME}（预览）`);
    } else if (legacyMenu) {
        await callApi(
            'POST',
            '/hippoadmin/menu/updateMenu',
            {
                token,
                body: {
                    menu_id: legacyMenu.menu_id,
                    menu_name: legacyMenu.menu_name || menuName,
                    menu_icon: legacyMenu.menu_icon || MENU_ICON,
                    component_name: COMPONENT_NAME,
                    component_address: COMPONENT_ADDRESS,
                    menu_type: 1,
                    parent_id: legacyMenu.parent_id ?? directoryId,
                    is_cached: Boolean(legacyMenu.is_cached),
                    is_show: legacyMenu.is_show !== false,
                    menu_sort: legacyMenu.menu_sort ?? 0,
                    menu_remark: legacyMenu.menu_remark || `${dirName} - ${menuName}（赛题 Demo，前端 mock 数据）`,
                },
            },
            '更新菜单组件名'
        );
        menuId = legacyMenu.menu_id;
        console.log(`[4/4] 已把菜单 menu_id=${menuId} 的组件名改为 ${COMPONENT_NAME}（不新建，不重复）`);
    } else if (dryRun) {
        console.log(`[4/4] 将创建菜单「${menuName}」（预览）`);
    } else {
        const created = await callApi(
            'POST',
            '/hippoadmin/menu/addMenu',
            {
                token,
                body: {
                    menu_name: menuName,
                    menu_icon: MENU_ICON,
                    component_name: COMPONENT_NAME,
                    component_address: COMPONENT_ADDRESS,
                    menu_type: 1,
                    parent_id: directoryId,
                    is_cached: false,
                    is_show: true,
                    menu_sort: 0,
                    menu_remark: `${dirName} - ${menuName}（赛题 Demo，前端 mock 数据）`,
                },
            },
            '创建菜单'
        );

        menuId = created?.menu_id || created?.data?.menu_id;
        if (!menuId) throw new Error('创建菜单成功但未返回 menu_id');
        console.log(`[4/4] 菜单创建成功 menu_id=${menuId}，父级=${directoryId}`);

        try {
            await callApi(
                'POST',
                '/hippoadmin/menu/status/save',
                { token, body: { menu_id: menuId, column_config: [] } },
                '创建菜单配置'
            );
            console.log('[4/4] 菜单配置已初始化');
        } catch (error) {
            console.warn(`[4/4] 菜单配置创建失败（不影响打开页面）：${error.message}`);
        }
    }

    // ---------- 可选：角色授权 ----------
    if (grantRole && menuId) {
        try {
            const auth = await callApi('GET', `/hippoadmin/role/auth/${grantRole}`, { token }, '读取角色权限');
            const menuIds = Array.from(
                new Set([...(auth?.menuIds || []), directoryId, menuId].filter((id) => Number(id) > 0))
            );

            if (dryRun) {
                console.log(`[授权] 将提交 menuIds=${menuIds.join(',')}（预览）`);
            } else {
                await callApi(
                    'POST',
                    `/hippoadmin/role/auth/config/${grantRole}`,
                    { token, body: { menuIds, operationIds: auth?.operationIds || [] } },
                    '角色授权'
                );
                console.log(`[授权] 已给角色 ${grantRole} 追加菜单权限：${menuIds.join(',')}`);
            }
        } catch (error) {
            console.warn(`[授权] 授权失败：${error.message}`);
            console.warn('[授权] 可稍后到「角色管理」手动勾选');
        }
    }

    console.log(LINE);
    console.log(' 完成');
    console.log(LINE);
    if (!dryRun) {
        console.log(` 目录 menu_id：${directoryId}`);
        console.log(` 菜单 menu_id：${menuId}`);
        console.log(` 访问地址：http://127.0.0.1:5009/${COMPONENT_NAME}`);
        console.log(' 刷新页面后，左侧菜单「' + dirName + '」下会出现「' + menuName + '」');
    }
}

main().catch((error) => {
    console.error('');
    console.error(`[CampusAi] 执行失败：${error.message}`);
    process.exit(1);
});

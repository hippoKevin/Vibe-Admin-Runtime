#!/usr/bin/env node

'use strict';

/**
 * 登记「智能管理」菜单（一个目录 + 三个子页面）
 *
 * 结构：智能管理（目录）
 *         ├─ Skill 管理   /src/pages/AgentAdmin/Skill/index.vue   AgentAdminSkillPage
 *         ├─ Agent 管理   /src/pages/AgentAdmin/Agent/index.vue   AgentAdminAgentPage
 *         └─ Tool 管理    /src/pages/AgentAdmin/Tool/index.vue    AgentAdminToolPage
 *
 * 三个页面分别管理仓库里的 ADMINAGENT/skills、ADMINAGENT/agent、ADMINAGENT/tools。
 *
 * 用法：
 *   node QuickStart/create_agent_admin_menus.js --username 账号 --password 密码
 *
 * 可选参数：
 *   --base        接口地址，默认 http://127.0.0.1:5004
 *   --grant-role  给指定角色授权（先读现有权限再合并，不会覆盖）
 *   --dry-run     只打印将要执行的操作
 *
 * 可重复执行：目录、子菜单、菜单配置已存在时会复用。
 */

const BASE_DEFAULT = 'http://127.0.0.1:5004';

/** 当前接口地址（main 里按 --base 覆盖） */
let BASE = BASE_DEFAULT;

const DIR_NAME = '智能管理';

/** 目录图标：与「系统运维」用同一套已验证可用的 tdesign 图标名 */
const DIR_ICON = 'server';
const DIR_REMARK = '智能管理目录（技能 / Agent / 工具）';

/** 三个子页面：名称 / 组件名 / 组件地址 / 图标 */
const PAGES = [
    { menu_name: 'Skill 管理', component_name: 'AgentAdminSkillPage', component_address: '/src/pages/AgentAdmin/Skill/index.vue', menu_icon: 'file-1' },
    { menu_name: 'Agent 管理', component_name: 'AgentAdminAgentPage', component_address: '/src/pages/AgentAdmin/Agent/index.vue', menu_icon: 'history' },
    { menu_name: 'Tool 管理', component_name: 'AgentAdminToolPage', component_address: '/src/pages/AgentAdmin/Tool/index.vue', menu_icon: 'dashboard' },
];

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

/** 菜单可能是树、也可能被包成 { total, data } / { list } 这种分页结构，统一拍平成数组 */
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
    const base = args.base || BASE_DEFAULT;
    BASE = base;
    const username = args.username || args.u;
    const password = args.password || args.p;
    const grantRole = args['grant-role'] ? String(args['grant-role']) : null;
    const dryRun = Boolean(args['dry-run']);

    if (!username || !password) {
        console.error('用法：node QuickStart/create_agent_admin_menus.js --username 账号 --password 密码 [--grant-role 1] [--dry-run]');
        process.exit(1);
    }

    console.log(LINE);
    console.log(' 登记「智能管理」菜单（目录 + 三个子页面）');
    console.log(LINE);
    console.log(`[AgentAdmin] 接口地址 ${base}`);
    for (const page of PAGES) {
        console.log(`[AgentAdmin]   ${page.menu_name} -> ${page.component_address}`);
    }
    console.log('');

    // ---------- 1. 登录 ----------
    const loginData = await callApi('POST', '/hippoadmin/common/login', { body: { username, password } }, '登录');
    const token = loginData?.token;
    if (!token) throw new Error('登录成功但未拿到 token');
    console.log('[1/4] 登录成功');

    // ---------- 2. 读菜单，找目录有没有 ----------
    const menus = flattenMenus(await callApi('GET', '/hippoadmin/menu/list', { token }, '读取菜单'));
    let directory = menus.find((item) => item.menu_name === DIR_NAME && Number(item.parent_id) === 0);
    let directoryId = directory?.menu_id || 0;
    console.log(`[2/4] 读取到 ${menus.length} 条菜单`);

    // ---------- 3. 目录 ----------
    if (directoryId) {
        console.log(`[3/4] 目录已存在，复用 menu_id=${directoryId}`);
    } else if (dryRun) {
        console.log(`[3/4] 将创建目录「${DIR_NAME}」（预览）`);
    } else {
        const created = await callApi(
            'POST',
            '/hippoadmin/menu/addMenu',
            {
                token,
                body: {
                    menu_name: DIR_NAME,
                    menu_icon: DIR_ICON,
                    menu_type: 0,
                    parent_id: 0,
                    is_cached: true,
                    is_show: true,
                    menu_remark: DIR_REMARK,
                },
            },
            '创建目录'
        );
        directoryId = created?.menu_id || created?.data?.menu_id;
        if (!directoryId) throw new Error('创建目录成功但未返回 menu_id');
        console.log(`[3/4] 目录创建成功 menu_id=${directoryId}`);
    }

    // ---------- 4. 三个子菜单 ----------
    const childIds = [];
    for (const page of PAGES) {
        const exists = menus.find((item) => item.component_name === page.component_name);
        if (exists) {
            childIds.push(exists.menu_id);
            console.log(`[4/4] ${page.menu_name} 已存在，复用 menu_id=${exists.menu_id}`);
            continue;
        }

        if (dryRun) {
            console.log(`[4/4] 将创建菜单「${page.menu_name}」（预览）`);
            continue;
        }

        const created = await callApi(
            'POST',
            '/hippoadmin/menu/addMenu',
            {
                token,
                body: {
                    menu_name: page.menu_name,
                    menu_icon: page.menu_icon,
                    component_name: page.component_name,
                    component_address: page.component_address,
                    menu_type: 1,
                    parent_id: directoryId,
                    is_cached: true,
                    is_show: true,
                    menu_remark: `智能管理 - ${page.menu_name}`,
                },
            },
            `创建菜单 ${page.menu_name}`
        );

        const menuId = created?.menu_id || created?.data?.menu_id;
        if (!menuId) throw new Error(`创建菜单 ${page.menu_name} 未返回 menu_id`);
        childIds.push(menuId);
        console.log(`[4/4] ${page.menu_name} 创建成功 menu_id=${menuId}`);

        try {
            await callApi('POST', '/hippoadmin/menu/status/save', { token, body: { menu_id: menuId, column_config: [] } }, '创建菜单配置');
        } catch (error) {
            console.warn(`[4/4]   ${page.menu_name} 菜单配置创建失败：${error.message}`);
        }
    }

    // ---------- 可选：角色授权 ----------
    if (grantRole) {
        try {
            const auth = await callApi('GET', `/hippoadmin/role/auth/${grantRole}`, { token }, '读取角色权限');
            const menuIds = Array.from(new Set([...(auth?.menuIds || []), directoryId, ...childIds])).filter((id) => Number(id) > 0);

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
        console.log(` 子菜单 menu_id：${childIds.join(' , ')}`);
        console.log(' 刷新页面后，「智能管理」下会看到 Skill / Agent / Tool 三个页面');
    }
}

main().catch((error) => {
    console.error('');
    console.error(`[AgentAdmin] 执行失败：${error.message}`);
    process.exit(1);
});

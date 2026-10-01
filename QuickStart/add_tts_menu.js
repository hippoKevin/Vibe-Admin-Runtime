#!/usr/bin/env node

'use strict';

/**
 * 在「智能管理」目录下登记「TTS 管理」菜单
 *
 * 结构：智能管理（目录，menu_id=132）
 *         ├─ Skill 管理
 *         ├─ Agent 管理
 *         ├─ Tool 管理
 *         └─ TTS 管理   /src/pages/AgentAdmin/Tts/index.vue   AgentAdminTtsPage
 *
 * 页面管理的是「输出音频的音色 + 影响输出声音的参数」，
 * 配置读写走后端 /hippoadmin/dev-agent/tts/config，落盘在 ADMINAGENT/tts-config.json。
 *
 * 用法：
 *   node QuickStart/add_tts_menu.js --username 账号 --password 密码
 *
 * 可选参数：
 *   --base        接口地址，默认 http://127.0.0.1:5004
 *   --grant-role  给指定角色授权（先读现有权限再合并，不会覆盖）
 *   --dry-run     只打印将要执行的操作
 *
 * 可重复执行：目录按名称（兜底 menu_id=132）查找，子菜单按 component_name 复用，
 * 已有的三条菜单不会被改动。
 */

const BASE_DEFAULT = 'http://127.0.0.1:5004';

const DIR_NAME = '智能管理';

/** 目录兜底 id：按名称找不到「智能管理」时用它（已知现状） */
const DIR_ID_FALLBACK = 132;

/** 要登记的页面：名称 / 组件名 / 组件地址 / 图标（图标用与现有菜单同一套已验证可用的 stem） */
const PAGE = {
    menu_name: 'TTS 管理',
    component_name: 'AgentAdminTtsPage',
    component_address: '/src/pages/AgentAdmin/Tts/index.vue',
    menu_icon: 'history',
};

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
async function callApi(method, path, { body, params, token, base } = {}, action = path) {
    const url = new URL(base.replace(/\/$/, '') + path);
    for (const [key, value] of Object.entries(params || {})) {
        if (value === undefined) continue;
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
        throw new Error(`${action}：请求失败（${error.message}），确认后端已启动在 ${base}`);
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
    const username = args.username || args.u;
    const password = args.password || args.p;
    const grantRole = args['grant-role'] ? String(args['grant-role']) : null;
    const dryRun = Boolean(args['dry-run']);

    if (!username || !password) {
        console.error('用法：node QuickStart/add_tts_menu.js --username 账号 --password 密码 [--grant-role 1] [--dry-run]');
        process.exit(1);
    }

    console.log(LINE);
    console.log(' 登记「TTS 管理」菜单（挂在「智能管理」目录下）');
    console.log(LINE);
    console.log(`[TtsMenu] 接口地址 ${base}`);
    console.log(`[TtsMenu]   ${PAGE.menu_name} -> ${PAGE.component_address}（${PAGE.component_name}）`);
    console.log('');

    // ---------- 1. 登录 ----------
    const loginData = await callApi('POST', '/hippoadmin/common/login', { body: { username, password }, base }, '登录');
    const token = loginData?.token;
    if (!token) throw new Error('登录成功但未拿到 token');
    console.log('[1/5] 登录成功');

    // ---------- 2. 读菜单 ----------
    const menus = flattenMenus(await callApi('GET', '/hippoadmin/menu/list', { token, base }, '读取菜单'));
    console.log(`[2/5] 读取到 ${menus.length} 条菜单`);

    // ---------- 3. 找「智能管理」目录：先按名字，找不到再用兜底 id ----------
    let directoryId = 0;
    const directory = menus.find((item) => item.menu_name === DIR_NAME && Number(item.parent_id) === 0);
    if (directory) {
        directoryId = Number(directory.menu_id);
        console.log(`[3/5] 找到目录「${DIR_NAME}」menu_id=${directoryId}`);
    } else {
        const byId = menus.find((item) => Number(item.menu_id) === DIR_ID_FALLBACK);
        if (byId) {
            directoryId = DIR_ID_FALLBACK;
            console.log(`[3/5] 未按名称找到「${DIR_NAME}」，按兜底 menu_id=${DIR_ID_FALLBACK}（${byId.menu_name}）挂靠`);
        } else {
            throw new Error(`未找到「${DIR_NAME}」目录（按名称与 menu_id=${DIR_ID_FALLBACK} 都没找到），请先跑 create_agent_admin_menus.js`);
        }
    }

    // ---------- 4. 子菜单 ----------
    const existing = menus.find((item) => item.component_name === PAGE.component_name);
    let menuId = existing?.menu_id || 0;
    let createdNow = false;

    if (menuId) {
        console.log(`[4/5] ${PAGE.menu_name} 已存在，复用 menu_id=${menuId}`);
        if (Number(existing.parent_id) !== directoryId) {
            console.warn(`[4/5]   注意：它当前挂在 parent_id=${existing.parent_id}，不是「${DIR_NAME}」（${directoryId}）`);
        }
    } else if (dryRun) {
        console.log(`[4/5] 将创建菜单「${PAGE.menu_name}」（预览）`);
    } else {
        const created = await callApi(
            'POST',
            '/hippoadmin/menu/addMenu',
            {
                token,
                base,
                body: {
                    menu_name: PAGE.menu_name,
                    menu_icon: PAGE.menu_icon,
                    component_name: PAGE.component_name,
                    component_address: PAGE.component_address,
                    menu_type: 1,
                    parent_id: directoryId,
                    is_cached: true,
                    is_show: true,
                    menu_remark: `智能管理 - ${PAGE.menu_name}（音色与声音参数）`,
                },
            },
            `创建菜单 ${PAGE.menu_name}`,
        );

        menuId = created?.menu_id || created?.data?.menu_id;
        if (!menuId) throw new Error(`创建菜单 ${PAGE.menu_name} 未返回 menu_id`);
        createdNow = true;
        console.log(`[4/5] ${PAGE.menu_name} 创建成功 menu_id=${menuId}`);

        try {
            await callApi('POST', '/hippoadmin/menu/status/save', { token, base, body: { menu_id: menuId, column_config: [] } }, '创建菜单配置');
        } catch (error) {
            console.warn(`[4/5]   菜单配置创建失败：${error.message}`);
        }
    }

    // ---------- 5. 可选：角色授权 ----------
    if (grantRole) {
        try {
            const auth = await callApi('GET', `/hippoadmin/role/auth/${grantRole}`, { token, base }, '读取角色权限');
            const menuIds = Array.from(new Set([...(auth?.menuIds || []), directoryId, menuId])).filter((id) => Number(id) > 0);

            if (dryRun) {
                console.log(`[5/5][授权] 将提交 menuIds=${menuIds.join(',')}（预览）`);
            } else {
                await callApi(
                    'POST',
                    `/hippoadmin/role/auth/config/${grantRole}`,
                    { token, base, body: { menuIds, operationIds: auth?.operationIds || [] } },
                    '角色授权',
                );
                console.log(`[5/5][授权] 已给角色 ${grantRole} 追加菜单权限：${menuIds.join(',')}`);
            }
        } catch (error) {
            console.warn(`[5/5][授权] 授权失败：${error.message}`);
            console.warn('[5/5][授权] 可稍后到「角色管理」手动勾选');
        }
    } else {
        console.log('[5/5] 未指定 --grant-role，跳过角色授权');
    }

    console.log(LINE);
    console.log(' 完成');
    console.log(LINE);
    if (!dryRun) {
        console.log(` 目录 menu_id：${directoryId}`);
        console.log(` 菜单 menu_id：${menuId}${createdNow ? '（本次新建）' : '（已存在，复用）'}`);
        console.log(' 刷新页面后，「智能管理」下会看到「TTS 管理」');
    }
}

main().catch((error) => {
    console.error('');
    console.error(`[TtsMenu] 执行失败：${error.message}`);
    process.exit(1);
});

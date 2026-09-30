#!/usr/bin/env node

'use strict';

/**
 * 把「系统运维」拆成三个子页面菜单
 *
 * 结构：系统运维（目录）
 *         ├─ 关于系统   /src/pages/SystemOps/About/index.vue   SystemOpsAboutPage
 *         ├─ 系统日志   /src/pages/SystemOps/Log/index.vue     SystemOpsLogPage
 *         └─ 环境配置   /src/pages/SystemOps/Env/index.vue     SystemOpsEnvPage
 *
 * 同时删除旧的单页菜单（component_name = SystemOpsPage）。
 *
 * 用法：
 *   node QuickStart/split_system_ops_menus.js --username 账号 --password 密码
 *
 * 可选参数：
 *   --base        接口地址，默认 http://127.0.0.1:5004
 *   --grant-role  给指定角色授权（先读现有权限再合并，不会覆盖）
 *   --keep-old    保留旧的 SystemOpsPage 菜单（默认会删除）
 *   --dry-run     只打印将要执行的操作
 *
 * 脚本可重复执行：目录、子菜单、菜单配置都已存在时会自动复用。
 */

const BASE_DEFAULT = 'http://127.0.0.1:5004';
const DIR_NAME = '系统运维';

/** 三个子页面：名称 / 组件名 / 组件地址 / 图标 */
const PAGES = [
    { menu_name: '关于系统', component_name: 'SystemOpsAboutPage', component_address: '/src/pages/SystemOps/About/index.vue', menu_icon: 'dashboard' },
    { menu_name: '系统日志', component_name: 'SystemOpsLogPage', component_address: '/src/pages/SystemOps/Log/index.vue', menu_icon: 'history' },
    { menu_name: '环境配置', component_name: 'SystemOpsEnvPage', component_address: '/src/pages/SystemOps/Env/index.vue', menu_icon: 'file-1' },
];

/** 需要移除的旧菜单组件名 */
const LEGACY_COMPONENTS = ['SystemOpsPage'];

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

async function callApi(method, path, options, label) {
    const { status, json } = await request(method, path, options);

    if (status < 200 || status >= 300) {
        const message = json?.message || json?.msg || json?.raw || `HTTP ${status}`;
        throw new Error(`${label}失败：${message}（HTTP ${status}）`);
    }

    if (json?.code !== 2000) {
        const message = json?.message || json?.msg || `业务码 ${json?.code}`;
        throw new Error(`${label}失败：${message}（code ${json?.code}）`);
    }

    return json.data;
}

function flattenMenus(list, result = []) {
    for (const item of list || []) {
        result.push(item);
        if (item.children?.length) flattenMenus(item.children, result);
    }
    return result;
}

function unwrapEntity(payload) {
    if (!payload) return null;
    if (payload.menu_id) return payload;
    if (payload.data?.menu_id) return payload.data;
    return null;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    BASE = String(args.base || BASE_DEFAULT).replace(/\/+$/, '');

    const username = args.username;
    const password = args.password;
    const grantRole = args['grant-role'] ? Number(args['grant-role']) : null;
    const keepOld = Boolean(args['keep-old']);
    const dryRun = Boolean(args['dry-run']);

    if (!username || !password) {
        console.error('缺少登录账号：请使用 --username 账号 --password 密码');
        process.exit(1);
    }

    console.log(LINE);
    console.log(' 拆分「系统运维」为三个子页面菜单');
    console.log(LINE);
    console.log(`[Split] 接口地址 ${BASE}`);
    PAGES.forEach((page) => console.log(`[Split]   ${page.menu_name} -> ${page.component_address}`));
    if (dryRun) console.log('[Split] 预览模式（--dry-run），不会写入数据');
    console.log('');

    // ---------- 1. 登录 ----------
    const loginData = await callApi('POST', '/hippoadmin/common/login', { body: { username, password } }, '登录');
    TOKEN = loginData?.token || loginData?.data?.token || '';
    if (!TOKEN) throw new Error('登录成功但没有拿到 token');
    console.log('[1/5] 登录成功');

    // ---------- 2. 读取现有菜单 ----------
    let menus = [];
    try {
        const menuPage = await callApi(
            'GET',
            '/hippoadmin/menu/list',
            { params: { 'ep[moldInfo]': '', 'paging[pageNumber]': 1, 'paging[pageSize]': 1000 } },
            '获取菜单列表'
        );
        menus = flattenMenus(menuPage?.data || []);
        console.log(`[2/5] 读取到 ${menus.length} 条菜单`);
    } catch (error) {
        console.warn(`[2/5] 读取菜单失败（${error.message}），跳过重复校验继续创建`);
    }

    // ---------- 3. 目录 ----------
    let directory = menus.find((item) => item.menu_name === DIR_NAME && Number(item.menu_type) === 0);
    let directoryId = directory?.menu_id;

    if (directoryId) {
        console.log(`[3/5] 目录已存在，复用 menu_id=${directoryId}`);
    } else if (dryRun) {
        console.log(`[3/5] 将创建目录「${DIR_NAME}」（预览）`);
        directoryId = 0;
    } else {
        const created = unwrapEntity(
            await callApi(
                'POST',
                '/hippoadmin/menu/addMenu',
                {
                    body: {
                        menu_name: DIR_NAME,
                        menu_icon: 'server',
                        menu_type: 0,
                        parent_id: 0,
                        is_cached: true,
                        is_show: true,
                        menu_remark: '系统运维目录'
                    }
                },
                '创建目录'
            )
        );
        directoryId = created?.menu_id;
        if (!directoryId) throw new Error('创建目录成功但未返回 menu_id');
        console.log(`[3/5] 目录创建成功 menu_id=${directoryId}`);
    }

    // ---------- 4. 三个子菜单 ----------
    const childIds = [];
    for (const page of PAGES) {
        const exists = menus.find((item) => item.component_name === page.component_name);

        if (exists) {
            childIds.push(exists.menu_id);
            console.log(`[4/5] ${page.menu_name} 已存在，复用 menu_id=${exists.menu_id}`);
            continue;
        }

        if (dryRun) {
            console.log(`[4/5] 将创建菜单「${page.menu_name}」（预览）`);
            continue;
        }

        const created = unwrapEntity(
            await callApi(
                'POST',
                '/hippoadmin/menu/addMenu',
                {
                    body: {
                        menu_name: page.menu_name,
                        menu_icon: page.menu_icon,
                        component_name: page.component_name,
                        component_address: page.component_address,
                        menu_type: 1,
                        parent_id: directoryId,
                        is_cached: true,
                        is_show: true,
                        menu_remark: `系统运维 - ${page.menu_name}`
                    }
                },
                `创建菜单 ${page.menu_name}`
            )
        );

        const menuId = created?.menu_id;
        if (!menuId) throw new Error(`创建菜单 ${page.menu_name} 未返回 menu_id`);
        childIds.push(menuId);
        console.log(`[4/5] ${page.menu_name} 创建成功 menu_id=${menuId}`);

        // 顺手建一条空列模板，方便之后在「菜单配置」里调整
        try {
            await callApi('POST', '/hippoadmin/menu/status/save', { body: { menu_id: menuId, column_config: [] } }, '创建菜单配置');
        } catch (error) {
            console.warn(`[4/5]   ${page.menu_name} 菜单配置创建失败：${error.message}`);
        }
    }

    // ---------- 5. 移除旧的单页菜单 ----------
    const legacyMenus = menus.filter((item) => LEGACY_COMPONENTS.includes(item.component_name));
    if (keepOld || !legacyMenus.length) {
        console.log('[5/5] 无需移除旧菜单');
    } else {
        for (const legacy of legacyMenus) {
            if (dryRun) {
                console.log(`[5/5] 将删除旧菜单 menu_id=${legacy.menu_id}（${legacy.menu_name}）（预览）`);
                continue;
            }
            try {
                await callApi('GET', '/hippoadmin/menu/delete', { params: { menuId: legacy.menu_id } }, '删除旧菜单');
                console.log(`[5/5] 旧菜单已删除 menu_id=${legacy.menu_id}`);
            } catch (error) {
                console.warn(`[5/5] 删除旧菜单失败（可手动在菜单管理里删）：${error.message}`);
            }
        }
    }

    // ---------- 可选：角色授权 ----------
    if (grantRole) {
        try {
            const auth = await callApi('GET', `/hippoadmin/role/auth/${grantRole}`, {}, '读取角色权限');
            const menuIds = Array.from(new Set([...(auth?.menuIds || []), directoryId, ...childIds]))
                .filter((id) => Number(id) > 0);

            if (dryRun) {
                console.log(`[授权] 将提交 menuIds=${menuIds.join(',')}（预览）`);
            } else {
                await callApi(
                    'POST',
                    `/hippoadmin/role/auth/config/${grantRole}`,
                    { body: { menuIds, operationIds: auth?.operationIds || [] } },
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
        console.log(' 刷新页面后，「系统运维」下会看到三个子页面');
    }
}

main().catch((error) => {
    console.error('');
    console.error(`[Split] 执行失败：${error.message}`);
    process.exit(1);
});

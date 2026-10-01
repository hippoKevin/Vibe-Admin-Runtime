#!/usr/bin/env node

'use strict';

/**
 * commit-workspace.mjs —— 工作区内的安全提交器（配合 skills/Workspace/SKILL.md）
 *
 * 它替 Agent 做三件事：
 *   1. 边界检查：所有待提交文件必须在工作区（仓库根目录）之内，且路径不含穿越；
 *   2. 体积/黑名单检查：拦下大文件、node_modules、dist、疑似密钥文件；
 *   3. 提交并打印回退命令：任何一次改动都能用返回的 sha 拉回。
 *
 * 用法：
 *   node ADMINAGENT/skills/Workspace/scripts/commit-workspace.mjs "提交信息" [选项]
 *
 * 选项：
 *   --all                 提交当前所有变更（默认只提示，不会替你选文件）
 *   --files a,b,c         只提交指定文件（相对工作区或绝对路径都行，必须在工作区内）
 *   --dry-run             只做检查并打印将要提交的内容
 *   --allow-large         允许提交超过体积上限的文件
 *
 * 退出码：0 = 成功（或 dry-run 检查通过）；1 = 检查失败
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** 单个文件体积上限（超过就拦下，需显式 --allow-large） */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** 永远不该被提交的路径片段 */
const FORBIDDEN_SEGMENTS = [
    'node_modules/',
    '/dist/',
    'ADMINAGENT/harness/docs/',
    'ADMINAGENT/harness/.agents/',
    'ADMINAGENT/harness/snapshots/',
];

/** 疑似密钥/本地私有文件 */
const SECRET_PATTERNS = [/\.env\.local$/, /\.pem$/, /\.key$/, /id_rsa$/, /\.p12$/];

function git(args, options = {}) {
    const result = spawnSync('git', args, {
        encoding: 'utf-8',
        cwd: options.cwd,
        stdio: options.inherit ? 'inherit' : 'pipe',
    });
    if (result.error) throw new Error(`无法执行 git：${result.error.message}`);
    return {
        code: result.status,
        stdout: (result.stdout || '').trim(),
        stderr: (result.stderr || '').trim(),
    };
}

function parseArgs(argv) {
    const args = { files: [], all: false, dryRun: false, allowLarge: false, message: '' };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--all') args.all = true;
        else if (token === '--dry-run') args.dryRun = true;
        else if (token === '--allow-large') args.allowLarge = true;
        else if (token === '--files') args.files = String(argv[(i += 1)] || '').split(',').map((s) => s.trim()).filter(Boolean);
        else if (!args.message) args.message = token;
    }

    return args;
}

function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!args.message) {
        console.error('用法：node commit-workspace.mjs "提交信息" [--all | --files a,b] [--dry-run] [--allow-large]');
        process.exit(1);
    }

    // ---------- 1. 找到工作区（仓库根） ----------
    const rootResult = git(['rev-parse', '--show-toplevel']);
    if (rootResult.code !== 0 || !rootResult.stdout) {
        console.error('❌ 当前目录不在 git 仓库里，无法提交');
        process.exit(1);
    }
    const root = path.resolve(rootResult.stdout).replace(/\\/g, '/');
    console.log(`[Workspace] 工作区根目录：${root}`);

    // ---------- 2. 收集待提交文件 ----------
    const status = git(['status', '--porcelain']);
    if (status.code !== 0) {
        console.error(`❌ 读取 git status 失败：${status.stderr}`);
        process.exit(1);
    }

    const changed = status.stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
            // porcelain v1 形如 "XY path"（XY 两位状态 + 一个空格），前两位直接切掉再 trim 最稳
            const raw = line.slice(2).trim();
            // 重命名形如 "old -> new"，取新路径
            const file = raw.includes(' -> ') ? raw.split(' -> ').pop() : raw;
            return file.replace(/^"|"$/g, '');
        });

    let targets = args.files.length ? args.files : changed;

    if (!targets.length) {
        console.log('[Workspace] 没有任何变更，无需提交');
        process.exit(0);
    }

    if (!args.files.length && !args.all) {
        console.log('[Workspace] 当前变更（未指定 --all，仅展示，不会提交）：');
        targets.forEach((file) => console.log(`  - ${file}`));
        console.log('[Workspace] 用 --all 提交全部，或 --files a,b 精确指定');
        process.exit(args.dryRun ? 0 : 1);
    }

    // ---------- 3. 边界与安全检查 ----------
    const problems = [];

    for (const file of targets) {
        const absolute = path.resolve(root, file).replace(/\\/g, '/');

        // 边界：必须在工作区之内
        if (absolute !== root && !absolute.startsWith(`${root}/`)) {
            problems.push(`越界（不在工作区内）：${file}`);
            continue;
        }

        const relative = absolute.slice(root.length + 1);
        const normalized = `/${relative}`;

        // 黑名单：依赖、构建产物、harness 大目录
        const hitForbidden = FORBIDDEN_SEGMENTS.find((seg) =>
            seg.startsWith('/') ? normalized.includes(seg) : normalized.includes(`/${seg}`),
        );
        if (hitForbidden) {
            problems.push(`命中黑名单（${hitForbidden}）：${relative}`);
            continue;
        }

        // 疑似密钥
        const secret = SECRET_PATTERNS.find((pattern) => pattern.test(relative));
        if (secret) {
            problems.push(`疑似密钥文件，需人工确认：${relative}`);
            continue;
        }

        // 体积
        try {
            const stat = fs.statSync(absolute);
            if (stat.isFile() && stat.size > MAX_FILE_SIZE && !args.allowLarge) {
                const mb = (stat.size / 1024 / 1024).toFixed(1);
                problems.push(`文件过大（${mb}MB > 5MB）：${relative}（确需提交可加 --allow-large）`);
            }
        } catch {
            // 删除的文件 statSync 会失败，属正常情况
        }
    }

    if (problems.length) {
        console.error('[Workspace] ❌ 检查未通过：');
        problems.forEach((item) => console.error(`  - ${item}`));
        process.exit(1);
    }

    console.log(`[Workspace] 检查通过，准备提交 ${targets.length} 个文件`);

    if (args.dryRun) {
        targets.forEach((file) => console.log(`  将要提交：${file}`));
        console.log(`[Workspace] dry-run 结束（未真正提交）：${args.message}`);
        process.exit(0);
    }

    // ---------- 4. 提交 ----------
    const add = git(['add', '--', ...targets]);
    if (add.code !== 0) {
        console.error(`❌ git add 失败：${add.stderr}`);
        process.exit(1);
    }

    const commit = git(['commit', '-m', args.message]);
    if (commit.code !== 0) {
        console.error(`❌ git commit 失败：${commit.stderr || commit.stdout}`);
        process.exit(1);
    }

    const sha = git(['rev-parse', '--short', 'HEAD']).stdout;
    const full = git(['rev-parse', 'HEAD']).stdout;

    console.log(`[Workspace] ✅ 已提交 ${sha}：${args.message}`);
    console.log('[Workspace] 随时可以这样拉回：');
    console.log(`  git show --stat ${sha}                 # 看改了什么`);
    console.log(`  git revert ${sha}                      # 反转这次提交（保留历史，最安全）`);
    console.log(`  git checkout ${sha}~1 -- <path>        # 只把某个文件恢复到提交前`);
    console.log(`  git reset --hard ${sha}~1              # 整仓回到提交前（危险，先确认）`);
    console.log(`  git push                               # 需要时加 -c http.proxy=http://127.0.0.1:7892`);
    console.log(`[Workspace] 完整 sha：${full}`);
}

main();

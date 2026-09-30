import * as fs from 'fs';
import * as path from 'path';
import { BusinessException } from 'src/common/exceptions/business.exception';

/**
 * 允许在「系统运维 - 环境配置」中维护的配置文件白名单
 * 不在白名单内的文件一律拒绝，避免通过接口读写任意文件
 */
export const ENV_FILE_WHITELIST = [
    '.env',
    '.env.development',
    '.env.production',
    '.env.local',
    '.env.test',
    '.env.example',
];

/** 服务端根目录（nest start / pm2 的工作目录） */
const SERVER_ROOT = process.cwd();

/** 敏感配置项：密码、密钥、令牌等 */
const SECRET_KEY_REGEX = /(PASSWORD|PASSWD|PWD|SECRET|TOKEN|KEY|AUTH)/i;

/** 合法的配置项名称 */
const ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_.]*$/;

/** env 文件中的一行 */
export interface EnvEntry {
    /** pair=配置项 comment=注释 blank=空行 */
    type: 'pair' | 'comment' | 'blank';
    /** 配置项名称 */
    key?: string;
    /** 配置项的值（已去掉首尾引号） */
    value?: string;
    /** 原始行内容：未修改的行按原样写回，注释、空行、引号风格都不会丢 */
    raw: string;
}

/** 需要写回的配置项 */
export interface EnvItem {
    key: string;
    value: string;
}

/** 是否为敏感配置项 */
export function isSecretKey(key: string): boolean {
    return SECRET_KEY_REGEX.test(key || '');
}

/**
 * 校验配置文件名称并解析为绝对路径
 * 白名单 + 目录二次校验，防止路径穿越
 */
export function resolveEnvFilePath(fileName: string): string {
    const name = String(fileName || '').trim();
    if (!ENV_FILE_WHITELIST.includes(name)) {
        throw new BusinessException(`不支持的配置文件：${name || '未指定'}`);
    }
    const filePath = path.resolve(SERVER_ROOT, name);
    if (path.dirname(filePath) !== path.resolve(SERVER_ROOT)) {
        throw new BusinessException('配置文件路径非法');
    }
    return filePath;
}

/** 服务端根目录 */
export function getServerRoot(): string {
    return SERVER_ROOT;
}

/** 列出服务端根目录下已存在的 env 文件 */
export function listEnvFileNames(): string[] {
    return ENV_FILE_WHITELIST.filter((name) =>
        fs.existsSync(path.resolve(SERVER_ROOT, name)),
    );
}

/**
 * 解析单行
 * 无法识别的行按注释处理，保证写回时内容不变
 */
export function parseEnvLine(raw: string): EnvEntry {
    const line = raw.trim();
    if (!line) return { type: 'blank', raw };
    if (line.startsWith('#')) return { type: 'comment', raw };

    const eq = line.indexOf('=');
    if (eq < 0) return { type: 'comment', raw };

    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    if (!ENV_KEY_REGEX.test(key)) return { type: 'comment', raw };

    let value = line.slice(eq + 1).trim();
    const quote = value[0];
    if (value.length >= 2 && (quote === '"' || quote === "'") && value.endsWith(quote)) {
        value = value.slice(1, -1);
        if (quote === '"') {
            value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
    }

    return { type: 'pair', key, value, raw };
}

/** 解析整个 env 文件，保留原有行顺序与注释 */
export function parseEnvContent(content: string): EnvEntry[] {
    return content.split(/\r?\n/).map((raw) => parseEnvLine(raw));
}

/** 按需给值加引号，避免空格、#、引号破坏文件格式 */
export function formatEnvValue(value: string): string {
    const text = String(value ?? '');
    if (text === '') return '';
    if (/[\s#'"]/.test(text)) {
        return `"${text
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')}"`;
    }
    return text;
}

/**
 * 把提交的配置项合并进原有行结构
 * - 已存在的项：值有变化才替换，没变化保留原始行
 * - 不存在的项：追加到文件末尾
 * 因此注释、空行、原有引号风格都不会被破坏
 */
export function applyEnvItems(entries: EnvEntry[], items: EnvItem[]): EnvEntry[] {
    const result = entries.map((entry) => ({ ...entry }));

    const keyIndex = new Map<string, number>();
    result.forEach((entry, index) => {
        if (entry.type === 'pair' && entry.key && !keyIndex.has(entry.key)) {
            keyIndex.set(entry.key, index);
        }
    });

    const handled = new Set<string>();
    for (const item of items || []) {
        const key = String(item?.key || '').trim();
        if (!key) continue;
        if (!ENV_KEY_REGEX.test(key)) {
            throw new BusinessException(`配置项名称非法：${key}`);
        }
        if (handled.has(key)) {
            throw new BusinessException(`配置项名称重复：${key}`);
        }
        handled.add(key);

        const value = String(item?.value ?? '');
        const index = keyIndex.get(key);

        if (index === undefined) {
            result.push({ type: 'pair', key, value, raw: `${key}=${formatEnvValue(value)}` });
            continue;
        }

        const old = result[index];
        if (old.value === value) continue; // 值没变：原样保留这一行
        result[index] = { type: 'pair', key, value, raw: `${key}=${formatEnvValue(value)}` };
    }

    return result;
}

/** 删除指定配置项（整行移除） */
export function removeEnvKeys(entries: EnvEntry[], keys: string[]): EnvEntry[] {
    const targets = new Set((keys || []).map((key) => String(key).trim()));
    if (!targets.size) return entries;
    return entries.filter(
        (entry) => !(entry.type === 'pair' && entry.key && targets.has(entry.key)),
    );
}

/** 还原为文件内容（保证以换行结尾） */
export function serializeEnvContent(entries: EnvEntry[]): string {
    const lines = entries.map((entry) => entry.raw);
    while (lines.length && lines[lines.length - 1] === '') {
        lines.pop();
    }
    return `${lines.join('\n')}\n`;
}

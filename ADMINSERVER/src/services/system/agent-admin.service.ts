import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { DevAgentService } from 'src/services/system/dev-agent.service';

/** 三类能力资产的目录约定（与 ADMINAGENT/README.md 一致） */
const KINDS = {
    skill: { label: '技能', dir: 'skills', doc: 'SKILL.md' },
    agent: { label: 'Agent', dir: 'agent', doc: 'AGENT.md' },
    tool: { label: '工具', dir: 'tools', doc: 'TOOL.md' },
} as const;

type AssetKind = keyof typeof KINDS;

/** 允许在线查看/编辑的文件后缀（避免误改二进制/大文件） */
const EDITABLE_EXTENSIONS = ['.md', '.json', '.ts', '.js', '.mjs', '.yaml', '.yml', '.txt', '.sh', '.cmd'];

/** 名称白名单：必须字母数字开头，且不允许路径分隔符 */
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** 路径片段白名单 */
const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** 列表里一句话描述的最大长度 */
const DESCRIPTION_LIMIT = 60;

/** 详情里单个文件的返回内容上限（超过就截断，避免长文本撑爆接口） */
const CONTENT_LIMIT = 200 * 1024;

/** 主文档顶部的 YAML front matter（只认 enabled 一个键，其余原样保留） */
const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** 列表项 */
export interface AssetItem {
    name: string;
    title: string;
    description: string;
    docName: string;
    hasDoc: boolean;
    fileCount: number;
    size: number;
    updatedAt: string;
    /** 是否启用（读自主文档顶部 front matter 的 enabled，缺省为启用） */
    enabled: boolean;
}

/** 目录内文件 */
export interface AssetFile {
    name: string;
    path: string;
    size: number;
    updatedAt: string;
    editable: boolean;
}

/**
 * 智能管理服务：管理 ADMINAGENT 下的 skills / agent / tools
 *
 * 安全要点：所有接口都只允许操作 ADMINAGENT/<约定目录> 内部的文件，
 * 名称与路径片段都走白名单校验，并二次确认解析后的绝对路径仍在根目录内，
 * 防止 ../ 之类的目录穿越。
 */
@Injectable()
export class AgentAdminService {
    private readonly logger = new Logger(AgentAdminService.name);

    constructor(private readonly devAgentService: DevAgentService) {}

    /**
     * 概览：三类资产数量 + harness 情况 + 开发模式是否就绪
     */
    getOverview() {
        const roots: Record<string, string> = {};
        const counts: Record<string, number> = {};

        for (const kind of Object.keys(KINDS) as AssetKind[]) {
            const root = this.getKindRoot(kind);
            roots[kind] = root;
            counts[kind] = this.safeReadDirs(root).length;
        }

        const harnessRoot = path.join(this.getAgentRoot(), 'harness');
        const pkgFile = path.join(harnessRoot, 'package.json');
        let version: string | null = null;

        if (fs.existsSync(pkgFile)) {
            try {
                version = JSON.parse(fs.readFileSync(pkgFile, 'utf-8')).version || null;
            } catch {
                version = null;
            }
        }

        const dsh = this.devAgentService.getStatus();

        return {
            harness: {
                present: fs.existsSync(path.join(harnessRoot, 'packages')),
                version,
                path: harnessRoot,
            },
            dsh: {
                ready: dsh.ready,
                hint: dsh.hint,
            },
            counts,
            roots,
        };
    }

    /**
     * 列表：某个 kind 下的所有条目
     * @param kindRaw skill / agent / tool
     */
    getList(kindRaw: string): { kind: AssetKind; docName: string; items: AssetItem[] } {
        const kind = this.normalizeKind(kindRaw);
        const root = this.getKindRoot(kind);
        const docName = KINDS[kind].doc;

        const items = this.safeReadDirs(root)
            .map((name) => this.buildItem(kind, name, root, docName))
            .sort((prev, next) => next.updatedAt.localeCompare(prev.updatedAt));

        return { kind, docName, items };
    }

    /**
     * 详情：指定文件（默认主文档）的内容 + 目录内文件清单
     * @param kindRaw skill / agent / tool
     * @param nameRaw 条目名
     * @param fileRaw 条目内相对路径，缺省看主文档
     */
    getDetail(kindRaw: string, nameRaw: string, fileRaw?: string) {
        const { kind, docName, dir, name } = this.resolveItem(kindRaw, nameRaw);
        const relative = String(fileRaw || '').trim() || docName;
        // 查看允许任意后缀（只读），保存才限制可编辑后缀
        const target = this.resolveFile(dir, relative, true);
        const content = fs.existsSync(target) ? this.readText(target) : '';

        // 启用状态始终看主文档（哪怕当前正在看别的文件）
        const docFile = path.join(dir, docName);
        const hasDoc = fs.existsSync(docFile);
        const enabled = hasDoc ? this.readEnabled(this.readText(docFile)) : true;

        return {
            kind,
            name,
            docName,
            file: relative,
            hasDoc,
            enabled,
            path: dir,
            content,
            files: this.listFiles(dir),
        };
    }

    /**
     * 保存条目内的某个文件
     */
    save(kindRaw: string, nameRaw: string, fileRaw: string, content: string) {
        const { dir } = this.resolveItem(kindRaw, nameRaw);
        const target = this.resolveFile(dir, fileRaw);

        if (!fs.existsSync(target)) {
            throw new BusinessException(`文件不存在：${fileRaw}（新文件请用「新建」或先创建条目）`);
        }
        if (Buffer.byteLength(content, 'utf-8') > CONTENT_LIMIT) {
            throw new BusinessException('内容过大，请控制在 200KB 以内');
        }

        fs.writeFileSync(target, content, 'utf-8');
        const size = fs.statSync(target).size;
        this.logger.log(`保存资产文件：${path.relative(this.getAgentRoot(), target)}（${size} 字节）`);

        return { saved: true, file: fileRaw, size };
    }

    /**
     * 按模板新建条目
     */
    create(kindRaw: string, nameRaw: string, title?: string) {
        const kind = this.normalizeKind(kindRaw);
        const name = this.normalizeName(nameRaw);
        const root = this.getKindRoot(kind);
        const dir = path.join(root, name);

        this.assertInside(root, dir);

        if (fs.existsSync(dir)) {
            throw new BusinessException(`「${name}」已存在`);
        }

        fs.mkdirSync(dir, { recursive: true });
        const docName = KINDS[kind].doc;
        fs.writeFileSync(path.join(dir, docName), this.buildTemplate(kind, title || name), 'utf-8');
        this.logger.log(`新建资产：${path.relative(this.getAgentRoot(), dir)}`);

        return { name, kind, docName, created: true };
    }

    /**
     * 启用 / 停用：写进主文档顶部的 front matter（enabled: true|false）
     *
     * 之所以写进 md 本身而不是另建配置文件：这份文档就是资产的全部，
     * 谁拿到这个 md 都能一眼看出它有没有被启用。
     */
    setEnabled(kindRaw: string, nameRaw: string, enabled: boolean) {
        const { dir, docName, name } = this.resolveItem(kindRaw, nameRaw);
        const docFile = path.join(dir, docName);

        if (!fs.existsSync(docFile)) {
            throw new BusinessException(`条目「${name}」缺少主文档 ${docName}，无法标记启用状态`);
        }

        const content = this.readText(docFile);
        const updated = this.writeEnabled(content, !!enabled);
        if (updated !== content) fs.writeFileSync(docFile, updated, 'utf-8');

        this.logger.log(`智能资产${enabled ? '启用' : '停用'}：${path.relative(this.getAgentRoot(), docFile)}`);
        return { name, enabled: !!enabled, file: docName };
    }

    /**
     * AI 润色：让 DSH 直接改写这份 md（保持结构、标题、表格与事实不变，只改措辞与表达）
     */
    async polish(kindRaw: string, nameRaw: string, fileRaw?: string) {
        const { dir, docName, name } = this.resolveItem(kindRaw, nameRaw);
        const relative = String(fileRaw || '').trim() || docName;
        const target = this.resolveFile(dir, relative, true);

        if (!fs.existsSync(target)) {
            throw new BusinessException(`文件不存在：${relative}`);
        }

        const repoRoot = this.getRepoRoot();
        const repoRelative = path.relative(repoRoot, target).replace(/\\/g, '/');

        const prompt = [
            `Polish the Markdown document at ${repoRelative}.`,
            'Keep every heading, table row, list item, link and fact unchanged; only improve wording, clarity, tone and consistency.',
            'Do not add or remove sections, do not translate it, and do not create new files.',
            `Write the improved content back to the same file (${repoRelative}).`,
        ].join('\n');

        const result = await this.devAgentService.runSyncTask(prompt);

        return {
            name,
            file: relative,
            path: repoRelative,
            ok: result.ok,
            exitCode: result.exitCode,
            duration: result.duration,
            output: result.output,
            files: result.files,
            error: result.error,
        };
    }

    /**
     * 删除条目（连同目录内文件）
     */
    remove(kindRaw: string, nameRaw: string) {
        const { dir, name } = this.resolveItem(kindRaw, nameRaw);

        if (!fs.existsSync(dir)) {
            throw new BusinessException(`「${name}」不存在`);
        }

        fs.rmSync(dir, { recursive: true, force: true });
        this.logger.warn(`删除资产：${path.relative(this.getAgentRoot(), dir)}`);

        return { name, removed: true };
    }

    // ------------------------------------------------------------------
    // 内部工具
    // ------------------------------------------------------------------

    /** ADMINAGENT 根目录 */
    private getAgentRoot(): string {
        return process.env.AGENT_ADMIN_ROOT
            ? path.resolve(process.env.AGENT_ADMIN_ROOT)
            : path.resolve(process.cwd(), '..', 'ADMINAGENT');
    }

    private getKindRoot(kind: AssetKind): string {
        return path.join(this.getAgentRoot(), KINDS[kind].dir);
    }

    private normalizeKind(kindRaw: string): AssetKind {
        const kind = String(kindRaw || '').trim().toLowerCase() as AssetKind;
        if (!KINDS[kind]) {
            throw new BusinessException('kind 只能是 skill / agent / tool');
        }
        return kind;
    }

    private normalizeName(nameRaw: string): string {
        const name = String(nameRaw || '').trim();
        if (!NAME_PATTERN.test(name)) {
            throw new BusinessException('名称只能由字母数字开头，且只含字母、数字、点、下划线、短横线');
        }
        return name;
    }

    /** 解析并校验条目目录，返回绝对路径 */
    private resolveItem(kindRaw: string, nameRaw: string) {
        const kind = this.normalizeKind(kindRaw);
        const name = this.normalizeName(nameRaw);
        const root = this.getKindRoot(kind);
        const dir = path.join(root, name);

        this.assertInside(root, dir);
        if (!fs.existsSync(dir)) {
            throw new BusinessException(`「${name}」不存在`);
        }
        if (!fs.statSync(dir).isDirectory()) {
            throw new BusinessException(`「${name}」不是目录`);
        }

        return { kind, name, root, dir, docName: KINDS[kind].doc };
    }

    /** 解析条目内的相对文件路径，并做穿越与类型校验 */
    private resolveFile(dir: string, fileRaw: string, allowAnyExtension = false): string {
        const value = String(fileRaw || '').trim().replace(/\\/g, '/');
        if (!value || path.isAbsolute(value)) {
            throw new BusinessException('文件路径不合法');
        }

        const segments = value.split('/').filter(Boolean);
        if (!segments.length || segments.some((segment) => !SEGMENT_PATTERN.test(segment))) {
            throw new BusinessException('文件路径不合法');
        }

        const target = path.resolve(dir, ...segments);
        this.assertInside(dir, target);

        if (!allowAnyExtension) {
            const extension = path.extname(target).toLowerCase();
            if (!EDITABLE_EXTENSIONS.includes(extension)) {
                throw new BusinessException(`不支持在线编辑 ${extension || '该类型'} 文件`);
            }
        }

        return target;
    }

    /** 断言目标路径确实在根目录内部（防目录穿越） */
    private assertInside(root: string, target: string) {
        const base = path.resolve(root);
        const resolved = path.resolve(target);
        if (resolved !== base && !resolved.startsWith(base + path.sep)) {
            throw new BusinessException('路径不合法');
        }
    }

    private safeReadDirs(root: string): string[] {
        try {
            if (!fs.existsSync(root)) return [];
            return fs
                .readdirSync(root, { withFileTypes: true })
                .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
                .map((entry) => entry.name);
        } catch (error) {
            this.logger.warn(`读取目录失败（${root}）：${error?.message || error}`);
            return [];
        }
    }

    private listFiles(dir: string, prefix = '', depth = 0): AssetFile[] {
        if (depth > 3) return [];

        const result: AssetFile[] = [];
        let entries: fs.Dirent[] = [];

        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return [];
        }

        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const full = path.join(dir, entry.name);
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                result.push(...this.listFiles(full, relative, depth + 1));
                continue;
            }

            try {
                const stat = fs.statSync(full);
                result.push({
                    name: entry.name,
                    path: relative,
                    size: stat.size,
                    updatedAt: stat.mtime.toISOString(),
                    editable: EDITABLE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase()),
                });
            } catch {
                // 单个文件读取失败就跳过，不影响整体
            }
        }

        return result.sort((prev, next) => prev.path.localeCompare(next.path));
    }

    private buildItem(kind: AssetKind, name: string, root: string, docName: string): AssetItem {
        const dir = path.join(root, name);
        const docFile = path.join(dir, docName);
        const hasDoc = fs.existsSync(docFile);
        const content = hasDoc ? this.readText(docFile) : '';
        const files = this.listFiles(dir);

        const size = files.reduce((total, file) => total + file.size, 0);
        const updatedAt = files.reduce((latest, file) => (file.updatedAt > latest ? file.updatedAt : latest), '');

        return {
            name,
            title: this.pickTitle(content) || name,
            description: this.pickDescription(content),
            docName,
            hasDoc,
            fileCount: files.length,
            size,
            updatedAt: updatedAt || new Date(0).toISOString(),
            enabled: hasDoc ? this.readEnabled(content) : true,
        };
    }

    /** 读 front matter 里的 enabled，没写就当启用 */
    private readEnabled(content: string): boolean {
        const match = String(content || '').match(FRONT_MATTER_PATTERN);
        if (!match) return true;

        const value = match[1].match(/^\s*enabled\s*:\s*(true|false)\s*$/im);
        return value ? value[1].toLowerCase() === 'true' : true;
    }

    /** 写回 enabled：已有 front matter 就地改这一行，没有就在文件最前面补一个 */
    private writeEnabled(content: string, enabled: boolean): string {
        const text = String(content || '');
        const match = text.match(FRONT_MATTER_PATTERN);
        const line = `enabled: ${enabled ? 'true' : 'false'}`;

        if (match) {
            const block = match[1];
            const updated = /^\s*enabled\s*:/im.test(block)
                ? block.replace(/^\s*enabled\s*:.*$/im, line)
                : `${line}\n${block}`;
            return text.replace(match[0], `---\n${updated}\n---\n`);
        }

        return `---\n${line}\n---\n\n${text}`;
    }

    /** 仓库根目录（DSH 任务的工作目录也是它，润色时要用相对路径告诉 Agent 改哪个文件） */
    private getRepoRoot(): string {
        return process.env.DSH_AGENT_CWD
            ? path.resolve(process.env.DSH_AGENT_CWD)
            : path.resolve(process.cwd(), '..');
    }

    private readText(file: string): string {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            if (Buffer.byteLength(content, 'utf-8') > CONTENT_LIMIT) {
                return `${content.slice(0, CONTENT_LIMIT)}\n\n…（内容过大，已截断）`;
            }
            return content;
        } catch (error) {
            this.logger.warn(`读取文件失败（${file}）：${error?.message || error}`);
            return '';
        }
    }

    /** 取第一个一级标题 */
    private pickTitle(content: string): string {
        const match = String(content || '').match(/^#\s+(.+)$/m);
        return match ? match[1].replace(/[#*`]/g, '').trim() : '';
    }

    /** 取标题之后的第一段普通文字，作为一句话描述 */
    private pickDescription(content: string): string {
        const lines = String(content || '').split(/\r?\n/);
        for (const line of lines) {
            const text = line.trim();
            if (!text || text.startsWith('#') || text.startsWith('|') || text.startsWith('---') || text.startsWith('```')) continue;
            const plain = text
                .replace(/^[-*\d.\s]+/, '')
                .replace(/[#*`>[\]]/g, '')
                .replace(/\(.*?\)/g, '')
                .trim();
            if (!plain) continue;
            return plain.length > DESCRIPTION_LIMIT ? `${plain.slice(0, DESCRIPTION_LIMIT)}…` : plain;
        }
        return '';
    }

    /** 新建条目的初始模板 */
    private buildTemplate(kind: AssetKind, title: string): string {
        if (kind === 'skill') {
            return `# ${title}

## 作用
一句话说明这个技能解决什么问题。

## 何时使用
- 适用：
- 不适用：

## 规则
1. 
2. 
`;
        }

        if (kind === 'agent') {
            return `# ${title}

## 角色
一句话人设。

## 职责
- 负责：
- 不负责：

## 挂载技能
| 技能 | 用途 |
| --- | --- |
| \`skills/Frontend\` |  |
| \`skills/Backend\` |  |

## 挂载工具
| 工具 | 用途 |
| --- | --- |
| \`tools/dev-agent-generate\` |  |

## 交付标准
- 
`;
        }

        return `# ${title}

## 作用
一句话说明它能干什么。

## 何时使用 / 不要使用
- 

## 入参
| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |

## 返回
成功与失败分别是什么结构。

## 安全与副作用
是否写文件、是否发请求、是否需要二次确认。
`;
    }
}

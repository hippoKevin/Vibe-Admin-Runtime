import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
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

/** 目录内节点：文件或目录 */
export interface AssetFile {
    name: string;
    path: string;
    size: number;
    updatedAt: string;
    editable: boolean;
    /** file = 文件（默认）/ dir = 目录。目录项让前端能把新建的空目录也显示出来 */
    type?: 'file' | 'dir';
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

        // 启用状态看**当前这个文件**：这样"只改当前选中文件"才成立
        const docFile = path.join(dir, docName);
        const hasDoc = fs.existsSync(docFile);
        const enabled = fs.existsSync(target) ? this.readEnabled(content) : true;

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
    /**
     * 启用 / 停用**指定文件**：写进该文件顶部的 front matter（enabled: true|false）
     *
     * 之所以写进 md 本身而不是另建配置文件：这份文档就是资产的全部，
     * 谁拿到这个 md 都能一眼看出它有没有被启用；并且只改这一个文件，不影响同目录其它文件。
     */
    setEnabled(kindRaw: string, nameRaw: string, enabled: boolean, fileRaw?: string) {
        const { dir, docName, name } = this.resolveItem(kindRaw, nameRaw);
        const relative = String(fileRaw || '').trim() || docName;
        const target = this.resolveFile(dir, relative, true);

        if (!fs.existsSync(target)) {
            throw new BusinessException(`文件不存在：${relative}`);
        }

        const content = this.readText(target);
        const updated = this.writeEnabled(content, !!enabled);
        if (updated !== content) fs.writeFileSync(target, updated, 'utf-8');

        this.logger.log(`智能资产${enabled ? '启用' : '停用'}：${path.relative(this.getAgentRoot(), target)}`);
        return { name, enabled: !!enabled, file: relative };
    }

    /**
     * 在条目目录里新建子目录或文件
     *
     * @param parentRaw 条目内相对目录，空字符串表示条目根目录；例如 `workflow`
     * @param nodeTypeBody `dir` = 目录 / `file` = 文件（文件没有后缀时自动补 .md）
     * @param nodeNameRaw 名称
     */
    createNode(kindRaw: string, nameRaw: string, parentRaw: string, nodeTypeBody: string, nodeNameRaw: string) {
        const { dir, name } = this.resolveItem(kindRaw, nameRaw);
        const parent = String(parentRaw || '')
            .trim()
            .replace(/\\/g, '/')
            .replace(/^\/+|\/+$/g, '');

        // 父目录同样走白名单与穿越校验（借道一个占位文件名拿到父目录）
        const parentDir = parent ? path.dirname(this.resolveFile(dir, `${parent}/placeholder.md`, true)) : dir;
        if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
            throw new BusinessException(`目录不存在：${parent || '（条目根目录）'}`);
        }

        const type = nodeTypeBody === 'dir' ? 'dir' : 'file';
        let nodeName = String(nodeNameRaw || '').trim();

        if (!NAME_PATTERN.test(nodeName)) {
            throw new BusinessException('名称只能由字母数字开头，且只含字母、数字、点、下划线、短横线');
        }
        if (type === 'file' && !path.extname(nodeName)) nodeName = `${nodeName}.md`;

        const target = path.resolve(parentDir, nodeName);
        this.assertInside(dir, target);

        if (fs.existsSync(target)) {
            throw new BusinessException(`已存在：${nodeName}`);
        }

        if (type === 'dir') {
            fs.mkdirSync(target, { recursive: true });
        } else {
            fs.writeFileSync(target, this.buildFileTemplate(nodeName), 'utf-8');
        }

        const relativePath = path.relative(dir, target).replace(/\\/g, '/');
        this.logger.log(
            `智能资产新建${type === 'dir' ? '目录' : '文件'}：${path.relative(this.getAgentRoot(), target)}`,
        );

        return { created: true, path: relativePath, nodeType: type, name };
    }

    /**
     * AI 润色：让 DSH 直接改写这份 md（保持结构、标题、表格与事实不变，只改措辞与表达）
     *
     * 为什么还要比对改写前后的内容：DSH 正常退出（exit=0）并不代表文件真的被改写了
     * ——它可能被文件策略拦下、只回答了没落盘、或者干脆没动手。只看退出码会得到
     * 「提示润色完成、文件却一动不动」的假成功，所以这里以磁盘内容为准。
     */
    async polish(kindRaw: string, nameRaw: string, fileRaw?: string) {
        const { dir, docName, name } = this.resolveItem(kindRaw, nameRaw);
        const relative = String(fileRaw || '').trim() || docName;
        const target = this.resolveFile(dir, relative, true);

        if (!fs.existsSync(target)) {
            throw new BusinessException(`文件不存在：${relative}`);
        }
        if (fs.statSync(target).isDirectory()) {
            throw new BusinessException(`「${relative}」是目录，不能润色，请选择文件`);
        }

        const repoRoot = this.getRepoRoot();
        const repoRelative = path.relative(repoRoot, target).replace(/\\/g, '/');
        const before = this.readRaw(target);

        const prompt = [
            `Polish exactly ONE Markdown document: ${repoRelative}`,
            'Modify ONLY that file. Do not create, edit, move, rename or delete any other file.',
            'Keep every heading, table row, list item, link and fact unchanged; only improve wording, clarity, tone and consistency.',
            'Keep any YAML front matter (the --- block at the top) byte-identical.',
            'Do not add or remove sections and do not translate it.',
            `You MUST write the improved content back to ${repoRelative} with the edit/write tool; answering without writing the file is a failed task.`,
        ].join('\n');

        // 异步起跑：一次润色实测约 100 秒，同步接口会让前端长时间空等、用户以为失败而反复点击。
        // 这里立刻返回 runId，前端轮询 /dev-agent/runs 看进度，跑完再比对磁盘内容判定是否真的改写。
        const runId = randomUUID();
        this.devAgentService.startBackgroundSyncTask(prompt, runId);

        return {
            started: true,
            runId,
            name,
            file: relative,
            path: repoRelative,
            /** 润色前的字节数，前端轮询结束后可比对 */
            beforeSize: Buffer.byteLength(before, 'utf8'),
        };
    }

    /**
     * 润色进度：按 runId 取运行状态，并带上该文件的最新字节数
     *
     * 为什么要自己判定「是否真的改写」：DSH 正常退出（exit=0）并不代表文件真的被改写
     * （可能被文件策略拦下、只回答了没落盘），只看退出码会得到
     * 「提示润色完成、文件却一动不动」的假成功，所以这里比对字节数，前端再比对内容。
     */
    getPolishStatus(kindRaw: string, nameRaw: string, fileRaw: string | undefined, runId: string) {
        const { dir, docName, name } = this.resolveItem(kindRaw, nameRaw);
        const relative = String(fileRaw || '').trim() || docName;
        const target = this.resolveFile(dir, relative, true);

        if (!fs.existsSync(target)) {
            throw new BusinessException(`文件不存在：${relative}`);
        }
        if (fs.statSync(target).isDirectory()) {
            throw new BusinessException(`「${relative}」是目录，不能润色，请选择文件`);
        }

        const run = this.devAgentService.findRun(runId);
        const content = this.readRaw(target);

        return {
            name,
            file: relative,
            path: path.relative(this.getRepoRoot(), target).replace(/\\/g, '/'),
            runId,
            /** 还查不到这条记录（刚提交的瞬间）时也返回 running，让前端继续轮询 */
            running: run ? run.running === true : true,
            found: !!run,
            ok: run?.ok === true,
            exitCode: run?.exitCode ?? null,
            /** 运行耗时（毫秒） */
            duration: run?.duration ?? 0,
            /** DSH 的最终答复，前端可折叠展示 */
            output: run?.output ?? '',
            error: run?.error || undefined,
            /** 该文件当前字节数，前端与提交前比对判断是否真的改写 */
            size: Buffer.byteLength(content, 'utf8'),
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

    /**
     * 删除条目里的一个文件或子目录（点哪个删哪个）
     *
     * @param pathRaw 条目内相对路径，例如 `workflow/new-page.md` 或 `workflow`
     */
    removeNode(kindRaw: string, nameRaw: string, pathRaw: string) {
        const { dir, name } = this.resolveItem(kindRaw, nameRaw);
        const relative = String(pathRaw || '')
            .trim()
            .replace(/\\/g, '/')
            .replace(/^\/+|\/+$/g, '');

        if (!relative) {
            throw new BusinessException('不能删除条目根目录，如需删除整个条目请用「删除条目」');
        }

        // 复用同一个相对路径校验：路径片段白名单 + 目录穿越断言
        const target = this.resolveFile(dir, relative, true);
        if (!fs.existsSync(target)) {
            throw new BusinessException(`不存在：${relative}`);
        }

        const isDir = fs.statSync(target).isDirectory();
        fs.rmSync(target, { recursive: isDir, force: true });
        this.logger.warn(`删除资产${isDir ? '目录' : '文件'}：${path.relative(this.getAgentRoot(), target)}`);

        return { name, path: relative, isDir, removed: true };
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
                // 目录本身也作为一项返回：否则新建的空目录不会出现在文件树里
                let updatedAt = new Date(0).toISOString();
                try {
                    updatedAt = fs.statSync(full).mtime.toISOString();
                } catch {
                    // 拿不到时间就用 0
                }

                result.push({
                    name: entry.name,
                    path: relative,
                    size: 0,
                    updatedAt,
                    editable: false,
                    type: 'dir',
                });
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
                    type: 'file',
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

    /** 新建文件时的初始内容 */
    private buildFileTemplate(fileName: string): string {
        const title = fileName.replace(/\.md$/i, '');
        return `# ${title}\n\n> 由「智能管理」新建，请补充内容。\n\n## 说明\n\n- \n`;
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

    /** 读未经截断的原始内容（比对润色前后是否真的改写时用，不能拿被截断的文本比） */
    private readRaw(file: string): string {
        try {
            return fs.readFileSync(file, 'utf-8');
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

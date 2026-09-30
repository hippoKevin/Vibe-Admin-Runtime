import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BusinessException } from 'src/common/exceptions/business.exception';
import {
    applyEnvItems,
    EnvItem,
    getServerRoot,
    isSecretKey,
    listEnvFileNames,
    parseEnvContent,
    removeEnvKeys,
    resolveEnvFilePath,
    serializeEnvContent,
} from 'src/common/utils/file/env-file.util';
import { logFileName, resolveLogDir } from 'src/common/logger/file.logger';
import { ReadLogDto, SaveEnvDto } from 'src/dto/system/system-ops/system-ops.dto';

/** 重启延迟（毫秒）：先让接口把结果返回前端，再执行重启 */
const RESTART_DELAY = 1000;

/** 日志文件名规则：只允许字母数字、下划线、中划线和点，防止路径穿越 */
const LOG_FILE_REGEX = /^[A-Za-z0-9_-]+\.log$/;

/** 日志默认显示行数 / 最大显示行数 */
const LOG_DEFAULT_LINES = 200;
const LOG_MAX_LINES = 2000;

/**
 * 系统运维服务
 * 包含：关于系统、系统日志、环境变量（.env）维护与系统重启
 */
@Injectable()
export class SystemOpsService {
    private readonly logger = new Logger(SystemOpsService.name);

    constructor(
        @InjectDataSource('etp_default_sql')
        private readonly dataSource: DataSource,
    ) {}

    // ==================================================================
    // 关于系统
    // ==================================================================

    /**
     * 关于系统：服务端运行信息、资源占用、数据库连接情况
     * 只返回原始数值（字节 / 秒），格式化交给前端处理
     */
    async getAbout() {
        const pkg = this.readServerPackage();
        const memory = process.memoryUsage();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const cpus = os.cpus();
        const logFiles = this.listLogFiles();

        return {
            app: {
                name: pkg.name,
                version: pkg.version,
                description: pkg.description,
                nodeEnv: process.env.NODE_ENV || 'development',
                pid: process.pid,
                // 进程启动时间 = 当前时间 - 已运行时长
                startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
                uptime: Math.floor(process.uptime()),
                serverTime: new Date().toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            runtime: {
                node: process.version,
                platform: `${os.platform()} ${os.release()}`,
                arch: os.arch(),
                hostname: os.hostname(),
                cwd: getServerRoot(),
            },
            cpu: {
                model: cpus[0]?.model?.trim() || '-',
                cores: cpus.length,
                speed: cpus[0]?.speed || 0,
                loadavg: os.loadavg().map((value) => Number(value.toFixed(2))),
            },
            memory: {
                total: totalMemory,
                free: freeMemory,
                used: totalMemory - freeMemory,
                usagePercent: totalMemory ? Math.round(((totalMemory - freeMemory) / totalMemory) * 100) : 0,
                processRss: memory.rss,
                processHeapUsed: memory.heapUsed,
                processHeapTotal: memory.heapTotal,
            },
            disk: this.getDiskInfo(),
            database: await this.getDatabaseInfo(),
            logs: {
                dir: resolveLogDir(),
                fileCount: logFiles.length,
                totalSize: logFiles.reduce((sum, item) => sum + item.size, 0),
            },
            env: {
                files: this.listEnvFileInfos(),
                activeFile: this.resolveActiveEnvFile(),
            },
        };
    }

    // ==================================================================
    // 系统日志
    // ==================================================================

    /**
     * 日志文件列表（按文件名倒序，最新在前）
     */
    getLogFiles() {
        return {
            dir: resolveLogDir(),
            current: logFileName(),
            files: this.listLogFiles(),
        };
    }

    /**
     * 读取日志内容：支持级别、关键字筛选，只返回末尾若干行
     */
    readLog(query: ReadLogDto) {
        const filePath = this.resolveLogFilePath(query?.file);
        if (!fs.existsSync(filePath)) {
            throw new BusinessException('日志文件不存在');
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        let lines = content.split(/\r?\n/);
        if (lines.length && lines[lines.length - 1] === '') {
            lines.pop(); // 去掉文件末尾的空行
        }

        const total = lines.length;

        // 级别筛选：日志行格式为 [时间] [级别] [上下文] 内容
        const level = String(query?.level || '').trim().toUpperCase();
        if (level) {
            lines = lines.filter((line) => line.includes(`[${level}]`));
        }

        // 关键字筛选
        const keyword = String(query?.keyword || '').trim().toLowerCase();
        if (keyword) {
            lines = lines.filter((line) => line.toLowerCase().includes(keyword));
        }
        const matched = lines.length;

        // 行数限制
        const limit = this.normalizeLines(query?.lines);
        const shown = lines.slice(-limit);

        const stat = fs.statSync(filePath);
        return {
            file: path.basename(filePath),
            size: stat.size,
            updatedAt: stat.mtime.toISOString(),
            total,
            matched,
            returned: shown.length,
            truncated: matched > shown.length,
            content: shown.join('\n'),
        };
    }

    /**
     * 清空日志文件（保留文件本身）
     */
    clearLog(file?: string) {
        const filePath = this.resolveLogFilePath(file);
        if (!fs.existsSync(filePath)) {
            throw new BusinessException('日志文件不存在');
        }

        fs.truncateSync(filePath, 0);
        this.logger.log(`系统运维：已清空日志文件 ${path.basename(filePath)}`);

        return { message: '日志已清空', file: path.basename(filePath) };
    }

    // ==================================================================
    // 环境配置（.env）
    // ==================================================================

    /**
     * 环境变量文件详情
     * 敏感项（密码 / 密钥）不回显内容，只标记 secret，避免明文泄露到浏览器；
     * 保存时留空即表示不修改
     */
    getEnvDetail(file?: string) {
        const files = this.listEnvFileInfos();
        if (!files.length) {
            throw new BusinessException('未找到可维护的配置文件');
        }

        const target = file || this.resolveActiveEnvFile() || files[0].name;
        const filePath = resolveEnvFilePath(target);
        if (!fs.existsSync(filePath)) {
            throw new BusinessException(`配置文件不存在：${target}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const entries = parseEnvContent(content);
        const stat = fs.statSync(filePath);

        return {
            file: target,
            activeFile: this.resolveActiveEnvFile(),
            files,
            size: stat.size,
            updatedAt: stat.mtime.toISOString(),
            lineCount: entries.length,
            items: entries
                .filter((entry) => entry.type === 'pair')
                .map((entry) => ({
                    key: entry.key,
                    value: isSecretKey(entry.key) ? '' : entry.value,
                    secret: isSecretKey(entry.key),
                    // 敏感项是否有值（前端用于显示“已设置”）
                    hasValue: String(entry.value ?? '') !== '',
                })),
        };
    }

    /**
     * 保存环境变量文件
     * 1. 写入前自动备份原文件到 backup/env
     * 2. 只改动有变化的行，注释与空行原样保留
     * 3. 需要重启时按当前运行方式选择重启策略
     */
    saveEnv(dto: SaveEnvDto) {
        const filePath = resolveEnvFilePath(dto.file);
        if (!fs.existsSync(filePath)) {
            throw new BusinessException(`配置文件不存在：${dto.file}`);
        }

        const original = fs.readFileSync(filePath, 'utf-8');
        const entries = parseEnvContent(original);
        const deletedKeys = (dto.deletedKeys || []).map((key) => String(key).trim());
        const deletedSet = new Set(deletedKeys);

        // 敏感项留空表示不修改：把原值补回去，避免误清空密码 / 密钥
        const items: EnvItem[] = (dto.items || [])
            .filter((item) => item && !deletedSet.has(String(item.key || '').trim()))
            .map((item) => {
                const key = String(item.key || '').trim();
                const value = String(item.value ?? '');
                if (isSecretKey(key) && value === '') {
                    const old = entries.find((entry) => entry.type === 'pair' && entry.key === key);
                    if (old) return { key, value: String(old.value ?? '') };
                }
                return { key, value };
            });

        let next = applyEnvItems(entries, items);
        next = removeEnvKeys(next, deletedKeys);

        const content = serializeEnvContent(next);
        if (content === original) {
            return {
                saved: false,
                changed: false,
                file: dto.file,
                message: '内容没有变化，无需重启',
                restart: { triggered: false, mode: 'none', message: '内容没有变化，无需重启' },
            };
        }

        const backup = this.backupEnvFile(filePath, original);
        fs.writeFileSync(filePath, content, 'utf-8');
        this.logger.log(`系统运维：配置文件 ${dto.file} 已更新（备份：${backup}）`);

        const restart = dto.restart
            ? this.restart()
            : { triggered: false, mode: 'none', message: '已保存，未重启' };

        return {
            saved: true,
            changed: true,
            file: dto.file,
            backup,
            message: '保存成功',
            restart,
        };
    }

    // ==================================================================
    // 系统重启
    // ==================================================================

    /**
     * 重启系统
     *
     * 按当前运行方式选择策略（都是先返回响应、延迟再重启）：
     * 1. pm2  —— 生产环境（ecosystem.config.js 托管），进程退出后 PM2 自动拉起
     * 2. watch —— 开发环境（nest start --watch），触碰入口文件让 ts 监听重新编译并重启
     * 3. manual —— 其他方式启动（如 node dist/main.js），不结束进程，交由人工重启
     */
    restart() {
        const mode = this.resolveRestartMode();

        if (mode === 'manual') {
            this.logger.warn('系统运维：未检测到 PM2 守护进程，已跳过自动重启');
            return {
                triggered: false,
                mode,
                message: '当前运行方式未检测到守护进程（PM2），服务未重启，请手动重启',
            };
        }

        // 延迟执行：保证接口响应先发出去，否则前端拿不到结果
        setTimeout(() => this.applyRestart(mode), RESTART_DELAY);

        return {
            triggered: true,
            mode,
            delay: RESTART_DELAY,
            message:
                mode === 'pm2'
                    ? 'PM2 托管环境，进程退出后会自动拉起'
                    : '已触发重新编译，开发服务将自动重启',
        };
    }

    /** 判断重启方式 */
    private resolveRestartMode(): 'pm2' | 'watch' | 'manual' {
        // 1. PM2 托管
        if (process.env.pm_id || process.env.PM2_HOME) return 'pm2';
        // 2. 开发环境：nest start --watch，入口文件存在才认为可以触发重编译
        if (fs.existsSync(this.watchEntryFile())) return 'watch';
        // 3. 其他方式
        return 'manual';
    }

    /** 执行重启 */
    private applyRestart(mode: 'pm2' | 'watch') {
        try {
            if (mode === 'pm2') {
                this.logger.log('系统运维：进程即将退出，交由 PM2 重新拉起');
                process.exit(0);
            }

            // 更新入口文件修改时间，触发 nest start --watch 重新编译并重启
            const entry = this.watchEntryFile();
            const now = new Date();
            fs.utimesSync(entry, now, now);
            this.logger.log('系统运维：已触发重新编译，服务即将自动重启');
        } catch (error) {
            this.logger.error(`系统运维：重启失败 ${error?.message || error}`);
        }
    }

    /** 开发环境入口文件 */
    private watchEntryFile(): string {
        return path.resolve(getServerRoot(), 'src/main.ts');
    }

    // ==================================================================
    // 内部方法
    // ==================================================================

    /** 日志文件列表 */
    private listLogFiles() {
        const dir = resolveLogDir();
        if (!fs.existsSync(dir)) return [];

        try {
            return fs
                .readdirSync(dir)
                .filter((name) => LOG_FILE_REGEX.test(name))
                .map((name) => {
                    const stat = fs.statSync(path.join(dir, name));
                    return {
                        name,
                        size: stat.size,
                        updatedAt: stat.mtime.toISOString(),
                    };
                })
                .sort((a, b) => b.name.localeCompare(a.name)); // 文件名带日期，倒序即最新在前
        } catch {
            return [];
        }
    }

    /** 校验日志文件路径，不传则取最新的日志 */
    private resolveLogFilePath(name?: string): string {
        const dir = resolveLogDir();
        const target = String(name || '').trim();

        if (!target) {
            const latest = this.listLogFiles()[0]?.name;
            if (!latest) throw new BusinessException('暂无日志文件');
            return path.join(dir, latest);
        }

        if (!LOG_FILE_REGEX.test(target)) {
            throw new BusinessException('日志文件名非法');
        }
        return path.join(dir, target);
    }

    /** 行数参数：非法值与越界值收敛到合理区间 */
    private normalizeLines(lines?: string): number {
        const value = Number(lines);
        if (!Number.isFinite(value) || value <= 0) return LOG_DEFAULT_LINES;
        return Math.min(Math.floor(value), LOG_MAX_LINES);
    }

    /**
     * 当前生效的 env 文件
     * 与 ConfigModule 的加载规则保持一致：
     * 生产环境使用默认的 .env，开发环境由 CommonModule 指定 .env.development
     */
    private resolveActiveEnvFile(): string {
        const candidates =
            process.env.NODE_ENV === 'production'
                ? ['.env', '.env.production']
                : ['.env.development', '.env'];

        return (
            candidates.find((name) =>
                fs.existsSync(path.resolve(getServerRoot(), name)),
            ) || null
        );
    }

    /** env 文件列表（带是否当前生效、大小、更新时间） */
    private listEnvFileInfos() {
        const active = this.resolveActiveEnvFile();

        return listEnvFileNames().map((name) => {
            const filePath = path.resolve(getServerRoot(), name);
            const stat = fs.statSync(filePath);
            return {
                name,
                active: name === active,
                size: stat.size,
                updatedAt: stat.mtime.toISOString(),
            };
        });
    }

    /** 写入前备份原文件：backup/env/<文件名>.<时间戳>.bak */
    private backupEnvFile(filePath: string, content: string): string {
        const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const dir = path.join(getServerRoot(), 'backup', 'env');
        fs.mkdirSync(dir, { recursive: true });

        const target = path.join(dir, `${path.basename(filePath)}.${stamp}.bak`);
        fs.writeFileSync(target, content, 'utf-8');

        return path.relative(getServerRoot(), target);
    }

    /** 读取服务端 package.json */
    private readServerPackage() {
        try {
            const file = path.resolve(getServerRoot(), 'package.json');
            return JSON.parse(fs.readFileSync(file, 'utf-8'));
        } catch {
            return { name: '-', version: '-', description: '' };
        }
    }

    /** 磁盘占用（部分平台 / Node 版本不支持 statfs，返回 null 由前端忽略） */
    private getDiskInfo() {
        try {
            const statfsSync = (fs as any).statfsSync;
            if (typeof statfsSync !== 'function') return null;

            const stat = statfsSync(getServerRoot());
            const total = stat.bsize * stat.blocks;
            const free = stat.bsize * stat.bavail;
            const used = total - free;

            return {
                total,
                free,
                used,
                usagePercent: total ? Math.round((used / total) * 100) : 0,
            };
        } catch {
            return null;
        }
    }

    /** 数据库连接信息（顺带做一次连通性检测，只返回连接耗时，不返回密码） */
    private async getDatabaseInfo() {
        const started = Date.now();
        const base = {
            type: 'mysql',
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT || 3306),
            database: process.env.DB_DATABASE || '',
            username: process.env.DB_USERNAME || '',
        };

        try {
            const rows = await this.dataSource.query(
                'SELECT VERSION() AS version, DATABASE() AS db',
            );
            return {
                ...base,
                connected: true,
                database: rows?.[0]?.db || base.database,
                version: rows?.[0]?.version || '',
                latency: Date.now() - started,
            };
        } catch (error) {
            return {
                ...base,
                connected: false,
                version: '',
                latency: Date.now() - started,
                error: error?.message || String(error),
            };
        }
    }
}

import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Repository } from 'typeorm';
import { OperationListEntity } from 'src/entities/system/operation.entity';
import { OperationLogEntity } from 'src/entities/system/other/operation_log.entity';

/** 需要记录的请求方式（读操作不记录，避免日志爆炸） */
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** 不记录的路径片段：审计接口自身、服务端原始日志读取、存活探测、心跳类接口 */
const IGNORED_PATH_PARTS = [
    '/audit/',
    '/log/read',
    '/log/files',
    '/ping',
    '/verifyToken',
    '/refresh_token',
];

/** 参数摘要里需要打码的字段名 */
const SECRET_KEY_REGEX = /(password|passwd|pwd|secret|token|authorization|apikey|api_key|private)/i;

/** 摘要与 UA 的最大长度 */
const SUMMARY_MAX_LENGTH = 120;
const UA_MAX_LENGTH = 250;

/** 单个参数值超过这个长度就视为长文本，不记进摘要 */
const SUMMARY_VALUE_MAX_LENGTH = 40;

/** 摘要里最多展示几个字段 */
const SUMMARY_MAX_FIELDS = 6;

/** 摘要里优先展示的字段名（id / 名称类字段最有用） */
const SUMMARY_PRIORITY_KEYS = /(id|name|account|username|user|role|menu|dept|unit|title|code|status|type|key|count|total)/i;

/** 摘要里直接跳过的「大块内容」字段：文件内容、正文之类，进来只会把日志撑爆 */
const SUMMARY_SKIP_KEYS = /^(content|text|html|markdown|md|body|payload|data|base64)$/i;

/**
 * 接口 → 人话操作名
 *
 * 数据库 operation_list 里的 operation_port 大多是空的，靠它反查不到中文名，
 * 所以这里内置一份路由对照表作为兜底；顺序敏感，更具体的路径写在前面。
 * destructive: true 用于把「看起来是查询、实际是写」的接口（如 GET menu/delete）也记进审计。
 */
interface OperationRoute {
    method: string;
    path: string;
    name: string;
    destructive?: boolean;
}

const OPERATION_ROUTES: OperationRoute[] = [
    // 登录与系统
    { method: 'POST', path: 'common/login', name: '登录系统' },
    { method: 'POST', path: 'common/refresh_default', name: '恢复默认数据', destructive: true },

    // 开发模式（自然语言 → DSH 生成代码）
    { method: 'POST', path: 'dev-agent/generate', name: '开发模式生成代码' },

    // 智能管理（技能 / Agent / 工具）
    { method: 'POST', path: 'agent-admin/create', name: '新建智能资产' },
    { method: 'POST', path: 'agent-admin/save', name: '保存智能资产' },
    { method: 'POST', path: 'agent-admin/remove', name: '删除智能资产', destructive: true },
    { method: 'POST', path: 'agent-admin/enabled', name: '启用停用智能资产' },
    { method: 'POST', path: 'agent-admin/polish', name: 'AI 润色智能资产' },

    // 用户
    { method: 'POST', path: 'user/add', name: '新增用户' },
    { method: 'POST', path: 'user/:userId/update', name: '修改用户' },
    { method: 'POST', path: 'user/:userId/delete', name: '删除用户', destructive: true },
    { method: 'POST', path: 'user/:userId/changePassword', name: '修改用户密码' },

    // 角色与权限
    { method: 'POST', path: 'role/add', name: '新增角色' },
    { method: 'POST', path: 'role/update/:role_id', name: '修改角色' },
    { method: 'POST', path: 'role/delete/:roleId', name: '删除角色', destructive: true },
    { method: 'POST', path: 'role/auth/config/:role_id', name: '配置角色权限' },

    // 菜单与菜单配置
    { method: 'POST', path: 'menu/addMenu', name: '新增菜单' },
    { method: 'POST', path: 'menu/updateMenu', name: '修改菜单' },
    { method: 'GET', path: 'menu/delete', name: '删除菜单', destructive: true },
    { method: 'POST', path: 'menu/status/save', name: '新增菜单列配置' },
    { method: 'POST', path: 'menu/status/update/:menu_status_id', name: '修改菜单列配置' },
    { method: 'POST', path: 'menu/status/delete/:menu_status_id', name: '删除菜单列配置', destructive: true },
    { method: 'POST', path: 'menu/addOperation', name: '新增菜单操作权限' },
    { method: 'GET', path: 'menu/deleteOperation', name: '删除菜单操作权限', destructive: true },

    // 数据导入
    { method: 'POST', path: 'excel/import/:menu_id', name: '导入数据' },
    { method: 'POST', path: 'excel/batch-import', name: '批量导入数据' },
    { method: 'GET', path: 'excel/clearHistory', name: '清空导入历史', destructive: true },

    // 文件
    { method: 'POST', path: 'files/upload', name: '上传文件' },
    { method: 'DELETE', path: 'files/:code', name: '删除文件', destructive: true },
    { method: 'POST', path: 'tools/uploadPicture', name: '上传图片' },

    // 系统运维
    { method: 'POST', path: 'system-ops/env/save', name: '修改环境配置' },
    { method: 'POST', path: 'system-ops/log/clear', name: '清空服务端日志', destructive: true },
    { method: 'POST', path: 'system-ops/restart', name: '重启系统' },
];

/** operation_list 的内存缓存，避免每次请求都查库 */
interface OperationCacheItem {
    method: string;
    regex: RegExp;
    name: string;
    sign: string;
    menuId: number;
}

/** 匹配结果 */
interface MatchedOperation {
    name: string;
    sign: string | null;
    menuId: number | null;
}

const OPERATION_CACHE_TTL = 60 * 1000;

/**
 * 操作审计拦截器
 *
 * 挂在 APP_INTERCEPTOR 上，自动记录所有写操作：
 * 操作人、接口、中文操作名（优先用 operation_list 反查，其次用内置路由表）、
 * 参数摘要（脱敏）、业务返回消息、成功与否、耗时、IP、浏览器标识。
 *
 * 写库失败只打日志，绝不影响正常业务。
 */
@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
    private readonly logger = new Logger(OperationLogInterceptor.name);

    private operationCache: OperationCacheItem[] = [];
    private operationCacheAt = 0;

    /** 内置路由表的正则缓存 */
    private readonly builtinRoutes = OPERATION_ROUTES.map((route) => ({
        ...route,
        regex: this.portToRegex(route.path),
    }));

    constructor(
        @InjectRepository(OperationLogEntity, 'etp_default_sql')
        private readonly logRepository: Repository<OperationLogEntity>,

        @InjectRepository(OperationListEntity, 'etp_default_sql')
        private readonly operationRepository: Repository<OperationListEntity>,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const method = String(request?.method || 'GET').toUpperCase();
        const url = String(request?.originalUrl || request?.url || '');

        if (IGNORED_PATH_PARTS.some((part) => url.includes(part))) return next.handle();

        const path = this.toPath(url);
        const builtin = this.matchBuiltin(method, path);

        // 写方法一律记录；GET 只在命中「实际是写」的接口时记录（如 GET menu/delete）
        const shouldRecord = WRITE_METHODS.includes(method) || (method === 'GET' && !!builtin?.destructive);
        if (!shouldRecord) return next.handle();

        const startedAt = Date.now();

        return next.handle().pipe(
            tap((data) => {
                void this.record(request, method, url, path, builtin, startedAt, true, data);
            }),
            catchError((error) => {
                void this.record(
                    request,
                    method,
                    url,
                    path,
                    builtin,
                    startedAt,
                    false,
                    error?.response ?? error,
                );
                return throwError(() => error);
            }),
        );
    }

    /**
     * 落库
     * 全程 try/catch，审计失败不能影响请求
     */
    private async record(
        request: any,
        method: string,
        url: string,
        path: string,
        builtin: (OperationRoute & { regex: RegExp }) | null,
        startedAt: number,
        handled: boolean,
        payload: any,
    ) {
        try {
            const user = request?.user ?? {};
            const operation = await this.resolveOperation(method, path, builtin);

            // 业务返回体可能是 { code, message, data }，也可能是异常响应
            const envelope = payload && typeof payload === 'object' ? payload : {};
            const code = typeof envelope.code === 'number' ? envelope.code : undefined;
            const success = handled && (code === undefined || code === 2000);

            await this.logRepository.insert({
                user_id: user.sub ?? null,
                username: user.username ?? null,
                role_id: typeof user.role_id === 'number' ? user.role_id : null,
                method,
                url: url.slice(0, 255),
                action_name: operation?.name ?? null,
                action_sign: operation?.sign ?? null,
                menu_id: operation?.menuId ?? null,
                summary: this.buildSummary(request),
                result_message: this.pickMessage(envelope) ?? (success ? null : '操作失败'),
                success,
                duration: Date.now() - startedAt,
                ip: this.pickIp(request),
                user_agent: String(request?.headers?.['user-agent'] ?? '').slice(0, UA_MAX_LENGTH) || null,
            });
        } catch (error) {
            this.logger.warn(`操作审计写入失败：${error?.message || error}`);
        }
    }

    /**
     * 解析操作名：数据库 operation_list 优先（可由「菜单管理 - 操作」维护），
     * 其次用内置路由表，最后返回 null 由前端展示 method + url
     */
    private async resolveOperation(
        method: string,
        path: string,
        builtin: (OperationRoute & { regex: RegExp }) | null,
    ): Promise<MatchedOperation | null> {
        await this.ensureOperationCache();

        const fromDatabase = this.operationCache.find(
            (item) => item.method === method && item.regex.test(path),
        );
        if (fromDatabase) {
            return {
                name: fromDatabase.name,
                sign: fromDatabase.sign,
                menuId: fromDatabase.menuId,
            };
        }

        if (builtin) return { name: builtin.name, sign: null, menuId: null };
        return null;
    }

    private matchBuiltin(method: string, path: string) {
        return this.builtinRoutes.find((route) => route.method === method && route.regex.test(path)) ?? null;
    }

    /** operation_list 60 秒缓存一次 */
    private async ensureOperationCache() {
        const now = Date.now();
        if (this.operationCache.length && now - this.operationCacheAt <= OPERATION_CACHE_TTL) return;

        try {
            const list = await this.operationRepository.find();
            this.operationCache = list
                // operation_port 为空的行无法用于匹配，直接跳过
                .filter((item) => item.operation_port && item.operation_port.trim())
                .map((item) => ({
                    method: String(item.operation_method || 'POST').toUpperCase(),
                    regex: this.portToRegex(String(item.operation_port)),
                    name: item.operation_name,
                    sign: item.operation_sign,
                    menuId: item.menu_id ?? null,
                }));
        } catch (error) {
            this.operationCache = [];
            this.logger.warn(`操作权限表读取失败：${error?.message || error}`);
        }

        this.operationCacheAt = now;
    }

    /** 取出不含前缀与查询串的路径，例如 menu/addMenu */
    private toPath(url: string): string {
        return url.split('?')[0].replace(/^\/hippoadmin\//, '').replace(/^\//, '');
    }

    /** operation_port（可能含 :id 占位）转正则 */
    private portToRegex(port: string): RegExp {
        const normalized = port.replace(/^\/hippoadmin\//, '').replace(/^\//, '');
        const pattern = normalized
            .split('/')
            .map((segment) => (segment.startsWith(':') ? '[^/]+' : this.escapeRegExp(segment)))
            .join('/');
        return new RegExp(`^/?${pattern}/?$`);
    }

    private escapeRegExp(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 参数摘要：把入参压成「key=value, key=value」的短文本
     *
     * 只记短文本，不记 JSON——系统日志页面要让人一眼看懂「改了什么/删了什么」。
     * 规则：数组记成 key=[N项]；字符串超过 40 字符视为长文本直接不记；
     *      密码/密钥类字段只留字段名（password=***）；最多记 6 个字段。
     */
    private buildSummary(request: any): string | null {
        const pairs: string[] = [];
        const usedKeys = new Set<string>();

        const pushScalar = (key: string, value: any) => {
            if (pairs.length >= SUMMARY_MAX_FIELDS) return;
            // 先判空再去重：登录入参里常有 value.password 这种空壳字段，
            // 否则会出现「password=***, password=***」这种重复摘要
            if (value === null || value === undefined || value === '') return;
            if (SUMMARY_SKIP_KEYS.test(key)) return;
            if (usedKeys.has(key)) return;

            usedKeys.add(key);

            if (SECRET_KEY_REGEX.test(key)) {
                pairs.push(`${key}=***`);
                return;
            }

            // 换行/连续空白压成单个空格，保证摘要始终是一行
            const text = String(value).replace(/\s+/g, ' ').trim();
            if (!text || text.length > SUMMARY_VALUE_MAX_LENGTH) return;
            pairs.push(`${key}=${text}`);
        };

        const collect = (value: any, depth = 0) => {
            if (!value || typeof value !== 'object' || depth > 3) return;
            if (pairs.length >= SUMMARY_MAX_FIELDS) return;

            if (Array.isArray(value)) {
                value.slice(0, 3).forEach((item) => collect(item, depth + 1));
                return;
            }

            const entries = Object.entries(value as Record<string, any>);
            // 关键字段（id/name/username…）优先展示
            const ordered = [
                ...entries.filter(([key]) => SUMMARY_PRIORITY_KEYS.test(key)),
                ...entries.filter(([key]) => !SUMMARY_PRIORITY_KEYS.test(key)),
            ];

            for (const [key, item] of ordered) {
                if (pairs.length >= SUMMARY_MAX_FIELDS) break;

                if (Array.isArray(item)) {
                    pairs.push(`${key}=[${item.length}项]`);
                    continue;
                }
                if (item && typeof item === 'object') {
                    collect(item, depth + 1);
                    continue;
                }
                pushScalar(key, item);
            }
        };

        collect(request?.params);
        collect(request?.query);
        collect(request?.body);

        if (!pairs.length) return null;

        const text = pairs.join(', ');
        return text.length > SUMMARY_MAX_LENGTH ? `${text.slice(0, SUMMARY_MAX_LENGTH)}…` : text;
    }

    /**
     * 从返回体里取提示语
     * 参数校验失败时 message 是数组，取第一条，前端才能看到「xxx不能为空」这种人话
     */
    private pickMessage(envelope: any): string | null {
        const message = envelope?.message ?? envelope?.msg;

        if (Array.isArray(message)) {
            const first = message.find((item) => typeof item === 'string');
            return first ? String(first).slice(0, 255) : null;
        }
        if (typeof message !== 'string' || !message) return null;
        return message.slice(0, 255);
    }

    private pickIp(request: any): string | null {
        const forwarded = request?.headers?.['x-forwarded-for'];
        if (typeof forwarded === 'string' && forwarded) {
            return forwarded.split(',')[0].trim().slice(0, 64);
        }
        const ip = request?.ip || request?.socket?.remoteAddress || '';
        // 去掉 IPv6 映射前缀，读起来更直观
        return String(ip).replace(/^::ffff:/, '').slice(0, 64) || null;
    }
}

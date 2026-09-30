import { Injectable, LoggerService } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 日志目录
 * 默认：服务端根目录/logs，可用环境变量 LOG_DIR 指定
 */
export function resolveLogDir(): string {
    return process.env.LOG_DIR
        ? path.resolve(process.env.LOG_DIR)
        : path.join(process.cwd(), 'logs');
}

/**
 * 按天生成日志文件名：app-YYYY-MM-DD.log
 */
export function logFileName(date: Date = new Date()): string {
    const pad = (num: number) => String(num).padStart(2, '0');
    return `app-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.log`;
}

/** 时间格式：YYYY-MM-DD HH:mm:ss.SSS */
function formatTime(date: Date = new Date()): string {
    const pad = (num: number, len = 2) => String(num).padStart(len, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
        `${pad(date.getMilliseconds(), 3)}`
    );
}

/** 单个日志文件写入上限（10MB），超过后不再写入，避免日志把磁盘写满 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 文件日志服务
 *
 * NestJS 默认只把日志输出到控制台，进程重启后无从追溯；
 * 这里在保留控制台输出的同时，按天追加写入 logs/app-YYYY-MM-DD.log，
 * 供「系统运维 - 系统日志」页面读取。
 *
 * 接入方式：main.ts 中 Logger.overrideLogger(new FileLogger())
 * 注意：控制台输出直接用 console，不能再用 Nest 的 Logger，
 * 否则会因为 Logger 已被替换而无限递归。
 */
@Injectable()
export class FileLogger implements LoggerService {
    /** 日志目录 */
    private readonly logDir = resolveLogDir();

    constructor() {
        this.ensureDir();
    }

    log(message: any, context?: string) {
        this.write('INFO', message, context);
        console.log(this.consoleText('INFO', message, context));
    }

    error(message: any, stack?: string, context?: string) {
        this.write('ERROR', message, context, stack);
        console.error(this.consoleText('ERROR', message, context), stack || '');
    }

    warn(message: any, context?: string) {
        this.write('WARN', message, context);
        console.warn(this.consoleText('WARN', message, context));
    }

    debug(message: any, context?: string) {
        this.write('DEBUG', message, context);
        console.debug(this.consoleText('DEBUG', message, context));
    }

    verbose(message: any, context?: string) {
        this.write('VERBOSE', message, context);
        console.log(this.consoleText('VERBOSE', message, context));
    }

    /**
     * 追加写入日志文件
     * 异步写入、异常静默：日志失败不能影响正常业务
     */
    private write(level: string, message: any, context?: string, stack?: string) {
        try {
            this.ensureDir();
            const file = path.join(this.logDir, logFileName());
            if (this.isOverSize(file)) return;

            fs.appendFile(file, `${this.lineText(level, message, context, stack)}\n`, () => {
                // 忽略写入异常
            });
        } catch {
            // 忽略写入异常
        }
    }

    /** 日志文件中的一行 */
    private lineText(level: string, message: any, context?: string, stack?: string): string {
        const text = this.toText(message);
        const ctx = context ? ` [${context}]` : '';
        const err = stack ? `\n${stack}` : '';
        return `[${formatTime()}] [${level}]${ctx} ${text}${err}`;
    }

    /** 控制台输出的一行 */
    private consoleText(level: string, message: any, context?: string): string {
        const text = this.toText(message);
        const ctx = context ? ` [${context}]` : '';
        return `[HC] ${formatTime()} [${level}]${ctx} ${text}`;
    }

    /** 统一把日志内容转成字符串 */
    private toText(message: any): string {
        if (message instanceof Error) return message.message;
        if (typeof message === 'string') return message;
        try {
            return typeof message === 'object' ? JSON.stringify(message) : String(message);
        } catch {
            return String(message);
        }
    }

    /** 是否已超过单文件上限 */
    private isOverSize(file: string): boolean {
        try {
            return fs.statSync(file).size >= MAX_FILE_SIZE;
        } catch {
            return false;
        }
    }

    /** 保证日志目录存在 */
    private ensureDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
}

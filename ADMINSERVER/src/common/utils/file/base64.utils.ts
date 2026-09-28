// files/utils/base64.util.ts

/**
 * 解析 base64 字符串，兼容两种格式：
 * 1. 带 data URL 前缀：data:image/png;base64,xxxxxx
 * 2. 纯 base64 字符串：xxxxxx
 *
 * @returns buffer 解码后的二进制内容；mimeType 从 data URL 前缀中解析出的 MIME 类型（纯 base64 时为 null）
 */
export function parseBase64(base64: string): { buffer: Buffer; mimeType: string | null } {
    const matches = base64.match(/^data:([^;]+);base64,(.+)$/);

    if (matches) {
        return {
            mimeType: matches[1],
            buffer: Buffer.from(matches[2], 'base64'),
        };
    }

    // 没有 data URL 前缀，当作纯 base64 内容处理
    return {
        mimeType: null,
        buffer: Buffer.from(base64, 'base64'),
    };
}

/**
 * 将文件内容读取并转换为带 data URL 前缀的 base64 字符串，方便前端 <img src> 直接使用
 */
export function toBase64DataUrl(buffer: Buffer, mimeType: string): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
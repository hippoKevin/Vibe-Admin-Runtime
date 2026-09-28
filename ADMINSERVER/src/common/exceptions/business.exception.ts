// src/common/exceptions/business.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 自定义业务异常：强制返回HTTP 200状态码，只携带业务错误码4000
 */
export class BusinessException extends HttpException {
  constructor(message: string,code?: number) {
    // 第一个参数：响应体（自定义格式）
    // 第二个参数：HTTP状态码（必须为200，避免前端识别为错误状态）
    super(
      {
        code: code ?? 4000, // 固定业务错误码
        message: message, // 错误描述
        data: null,
      },
      HttpStatus.OK, // 关键：返回200 OK，前端不会视为网络错误
    );
  }
}
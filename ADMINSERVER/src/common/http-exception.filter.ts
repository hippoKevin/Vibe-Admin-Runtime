// 错误返回过滤器
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status = 200;

    // 默认错误码
    let code = 4000;
    let message = exception.message || '服务器错误';

    // 如果是自定义消息对象
    const exceptionResponse = exception.getResponse();
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const res: any = exceptionResponse;
      code = res.code || 4000;
      message = res.message || message;
    }

    response.status(status).json(
      {
        code,
        msg: message,
        data: null,
      }
    );
  }
}
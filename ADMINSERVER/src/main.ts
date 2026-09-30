import { NestFactory, Reflector } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/transform.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { corsConfig } from './common/cors';
import { FileLogger } from './common/logger/file.logger';

async function bootstrap() {
  // 日志：控制台输出 + 按天写入 logs 目录，供「系统运维 - 系统日志」查看
  Logger.overrideLogger(new FileLogger());

  const app = await NestFactory.create(AppModule, {
    bodyParser: true 
  });

  // 全局接口前缀：所有接口路径前自动添加 /hippoadmin
  app.setGlobalPrefix('hippoadmin');

  // 全局拦截器（统一成功返回）
  app.useGlobalInterceptors(new TransformInterceptor(
    new Reflector(),
  ));

  // cors跨域
   app.enableCors(corsConfig);

  // 全局异常过滤器（统一错误返回）
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(5004);
}
bootstrap();
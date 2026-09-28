import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/transform.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { corsConfig } from './common/cors';

async function bootstrap() {
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
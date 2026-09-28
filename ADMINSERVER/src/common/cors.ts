// src/config/cors.ts

import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * CORS 跨域配置
 * 开发环境建议允许所有来源，生产环境建议只允许指定域名
 */
export const corsConfig: CorsOptions = {
  origin: true, // true 表示允许所有来源，生产环境建议改为具体域名数组
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type, Accept, Authorization',
  credentials: true, // 允许跨域请求携带 Cookie
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
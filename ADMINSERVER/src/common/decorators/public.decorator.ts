/**
 * 公开路由装饰器，无需token访问
 * *****
 * public router decorator, can't access without token
 * *****
 */

import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = 'isPublic';

// create a decorator
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
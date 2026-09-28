/**
 * 数据数量展示装饰器
 * ******
 * The show data amount decorator
 * ******
 */

import { SetMetadata } from '@nestjs/common';

export const SHOW_DATA_NUM = 'SHOW_DATA_NUM';

// 创建装饰器
export const ShowDataNum = (value: boolean = true) => SetMetadata(SHOW_DATA_NUM, value);

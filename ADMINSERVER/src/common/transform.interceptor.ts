import { Injectable, CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core'; 
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SHOW_DATA_NUM } from './decorators/showDataNum.decorators';

// 定义一个简单的接口来检查是否是分页结果
interface PaginatedResponse {
  data: any[];
  total: number;
  pageNumber?: number;
  pageSize?: number;
}

// 辅助函数：判断是否是分页结果对象
function isPaginatedResult(obj: any): obj is PaginatedResponse {
  return (
    typeof obj === 'object' && 
    obj !== null && 
    'data' in obj && 
    'total' in obj && 
    Array.isArray(obj.data) &&
    typeof obj.total === 'number'
  );
}

// ... 前面的 import 保持不变

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private defaultMessage: string = '操作成功'
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((response) => {
        // 1. 提取 Message
        const message = (typeof response === 'object' && response !== null && 'message' in response) 
          ? response.message 
          : this.defaultMessage;

        let businessData = response;
        
        // 2. 剔除 Service 意外返回的 message 字段
        if (typeof businessData === 'object' && businessData !== null && 'message' in businessData) {
           const { message: _, ...rest } = businessData;
           businessData = rest; 
        }

        // 3. 核心判断：是否已经是分页结果（来自 @PaginatedQuery）
        // 我们假设分页结果一定包含 'total' 和 'data' 字段
        const isPaginated = 
          typeof businessData === 'object' && 
          businessData !== null && 
          'total' in businessData && 
          'data' in businessData;

        if (isPaginated) {
          // 如果是分页结果，我们直接把它作为 data 返回
          // 此时前端接收到的结构是：
          // { code: 2000, data: { total: 100, data: [...] } }
          return {
            code: 2000,
            message: message,
            data: businessData 
          };
        }

        // 4. 普通数组处理 (SHOW_DATA_NUM)
        const showNum = this.reflector.get<any>(SHOW_DATA_NUM, context.getHandler());
        if (showNum !== undefined && Array.isArray(businessData)) {
           businessData = {
             total: businessData.length, 
             data: businessData, 
           };
           // 返回结构同上
           return {
             code: 2000,
             message: message,
             data: businessData
           };
        }

        // 5. 普通对象/其他数据
        return {
          code: 2000,
          message: message,
          data: businessData ?? null, 
        };
      }),
    );
  }
}
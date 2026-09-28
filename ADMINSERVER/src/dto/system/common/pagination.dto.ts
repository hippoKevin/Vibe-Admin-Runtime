// src/common/dto/pagination.dto.ts
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** 分页参数 DTO（与前端 searchForm.paging 一致） */
export class PagingDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageNumber: number = 1; // 默认第1页

  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageSize: number = 10; // 默认每页10条

  @IsOptional()
  @IsString()
  sortField?: string; // 排序字段

  @IsOptional()
  @IsString()
  sortDirection?: 'asc' | 'desc'; // 排序方向
}

export class BaseSearchDto<T = Record<string, any>> {
  ep: T; // 业务查询条件（如菜单名称、用户状态）

  @Type(() => PagingDto)
  paging: PagingDto; // 分页参数

  @IsOptional()
  cdList?: any[]; // 筛选条件列表
}
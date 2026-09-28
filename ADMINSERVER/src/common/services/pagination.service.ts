// src/common/services/pagination.service.ts
import { Injectable } from '@nestjs/common';
import { Repository, FindOptionsOrder, Like, FindOptionsWhere } from 'typeorm';
import { SearchForm, PaginatedResult, FilterData } from '../types/pagination.types';

@Injectable()
export class PaginationService {

  async paginate<T>(
    repository: Repository<T>,
    searchForm: SearchForm,
    extraWhere?: FindOptionsWhere<T>,
  ): Promise<PaginatedResult<T>> {
    const { ep = {}, paging = {}, cdList = [] } = searchForm;

    const pageNumber   = Math.max(1, paging.pageNumber || 1);
    const pageSize     = Math.max(1, paging.pageSize || 10);
    const sortField    = paging.sortField || 'created_at';
    const sortDirection = paging.sortDirection || 'DESC';

    // ─── 0. 软删除过滤：如果这个实体存在 is_deleted 列，默认只查未删除的数据 ──
    // 用 repository.metadata 判断该实体是否真的定义了 is_deleted 字段，
    // 避免对没有这个字段的表（如库存流水、文件表）强行拼接导致 SQL 报错
    const hasIsDeletedColumn = repository.metadata.columns.some(
      (col) => col.propertyName === 'is_deleted',
    );

    const softDeleteWhere: Record<string, any> = {};
    if (hasIsDeletedColumn) {
      // 只有调用方没有在 ep 或 extraWhere 里显式指定 is_deleted 时，才自动加上默认过滤，
      // 这样如果某些场景（比如"回收站"页面）需要专门查已删除的数据，
      // 只要显式传 { is_deleted: true } 就能覆盖掉这个默认行为
      const callerSpecifiedIsDeleted =
        ep?.is_deleted !== undefined || (extraWhere as any)?.is_deleted !== undefined;

      if (!callerSpecifiedIsDeleted) {
        softDeleteWhere.is_deleted = false;
      }
    }

    // ─── 1. ep 简单条件（原有逻辑） ───────────────────────────────────
    const epWhere: FindOptionsWhere<T> = {
      ...softDeleteWhere,
      ...extraWhere,
    } as FindOptionsWhere<T>;
    Object.keys(ep).forEach((key) => {
      const value = ep[key];
      if (value !== undefined && value !== null && value !== '') {
        epWhere[key] = typeof value === 'string' ? Like(`%${value}%`) : value;
      }
    });

    // ─── 2. cdList 高级过滤条件 ───────────────────────────────────────
    const hasFilter = cdList && cdList.length > 0 && cdList[0]?.fieldName;

    // ─── 3. 排序 ──────────────────────────────────────────────────────
    const order: FindOptionsOrder<T> = {};
    const sortDirectionUpper = (sortDirection || 'DESC').toUpperCase() as 'ASC' | 'DESC';
    if (sortField) {
      order[sortField] = sortDirectionUpper;
    }

    // ─── 4. 无高级过滤：直接 findAndCount ─────────────────────────────
    if (!hasFilter) {
      const [data, total] = await repository.findAndCount({
        where: epWhere,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        order,
      });
      return { data, total, pageNumber, pageSize };
    }

    // ─── 5. 有高级过滤：QueryBuilder ──────────────────────────────────
    const alias = 'entity';
    const qb = repository.createQueryBuilder(alias);

    // 软删除过滤同样要应用到 QueryBuilder 分支
    if (hasIsDeletedColumn && softDeleteWhere.is_deleted !== undefined) {
      qb.andWhere(`${alias}.is_deleted = :isDeleted`, { isDeleted: softDeleteWhere.is_deleted });
    }

    // 先把 ep 条件加进去（全部 AND），排除掉已经处理过的 is_deleted，避免重复拼接
    Object.keys(epWhere).forEach((key) => {
      if (key === 'is_deleted' && softDeleteWhere.is_deleted !== undefined) return;
      const value = ep[key];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string') {
          qb.andWhere(`${alias}.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else {
          qb.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
        }
      }
    });

    // 解析 cdList 条件
    this.applyCdList(qb, alias, cdList);

    // 排序
    if (sortField) {
      qb.orderBy(`${alias}.${sortField}`, sortDirectionUpper);
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((pageNumber - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { data, total, pageNumber, pageSize };
  }

  // ─── 解析 cdList 生成 WHERE 语句 ──────────────────────────────────
  private applyCdList<T>(qb: any, alias: string, cdList: FilterData[]) {
    cdList.forEach((item, index) => {
      if (!item.fieldName || item.fieldValue === null || item.fieldValue === undefined || item.fieldValue === '') return;

      const paramKey  = `cdParam_${index}`;
      const paramKey1 = `cdParam_${index}_1`;
      const field     = `${alias}.${item.fieldName}`;

      const { clause, params } = this.buildClause(field, item, paramKey, paramKey1);
      if (!clause) return;

      if (index === 0) {
        qb.andWhere(clause, params);
      } else {
        const prevAndNext = cdList[index - 1]?.andNext;
        if (prevAndNext === '1') {
          qb.andWhere(clause, params);
        } else if (prevAndNext === '0') {
          qb.orWhere(clause, params);
        }
      }
    });
  }

  private buildClause(
    field: string,
    item: FilterData,
    paramKey: string,
    paramKey1: string,
  ): { clause: string; params: Record<string, any> } {
    const { operation, fieldValue, fieldValue1, type } = item;
    const empty = { clause: '', params: {} };

    const castField = type === 'NUMBER' ? `CAST(${field} AS DECIMAL(20,6))` : field;

    switch (operation) {
      case 'INCLUDE':
        return { clause: `${field} LIKE :${paramKey}`, params: { [paramKey]: `%${fieldValue}%` } };
      case 'NOTINCLUDE':
        return { clause: `${field} NOT LIKE :${paramKey}`, params: { [paramKey]: `%${fieldValue}%` } };
      case 'STARTWITH':
        return { clause: `${field} LIKE :${paramKey}`, params: { [paramKey]: `${fieldValue}%` } };
      case 'ENDWITH':
        return { clause: `${field} LIKE :${paramKey}`, params: { [paramKey]: `%${fieldValue}` } };
      case 'EQ':
        return { clause: `${castField} = :${paramKey}`, params: { [paramKey]: fieldValue } };
      case 'NE':
        return { clause: `${castField} != :${paramKey}`, params: { [paramKey]: fieldValue } };
      case 'GT':
        return { clause: `${castField} > :${paramKey}`, params: { [paramKey]: fieldValue } };
      case 'GE':
        return { clause: `${castField} >= :${paramKey}`, params: { [paramKey]: fieldValue } };
      case 'LT':
        return { clause: `${castField} < :${paramKey}`, params: { [paramKey]: fieldValue } };
      case 'LE':
        return { clause: `${castField} <= :${paramKey}`, params: { [paramKey]: fieldValue } };
      case 'BW':
        if (fieldValue === null || fieldValue === undefined || fieldValue1 === null || fieldValue1 === undefined) {
          return empty;
        }
        return {
          clause: `${castField} BETWEEN :${paramKey} AND :${paramKey1}`,
          params: { [paramKey]: fieldValue, [paramKey1]: fieldValue1 },
        };
      default:
        return empty;
    }
  }
}
// src/dto/system/system-ops/system-ops.dto.ts
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

/** 单个配置项 */
export class EnvItemDto {
    @IsString()
    @IsNotEmpty({ message: '配置项名称不能为空' })
    key: string;

    @IsString()
    value: string;
}

/** 保存环境变量文件 */
export class SaveEnvDto {
    /** 目标文件，取值见 env-file.util.ts 的白名单 */
    @IsString()
    @IsNotEmpty({ message: '请选择配置文件' })
    file: string;

    /** 前端提交的配置项（全量） */
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EnvItemDto)
    items: EnvItemDto[];

    /** 需要删除的配置项名称 */
    @IsOptional()
    @IsArray()
    deletedKeys?: string[];

    /** 保存后是否重启系统 */
    @IsOptional()
    @IsBoolean()
    restart?: boolean;
}

/** 读取日志 */
export class ReadLogDto {
    /** 日志文件名，不传则读取最新的日志 */
    @IsOptional()
    @IsString()
    file?: string;

    /** 显示末尾行数（字符串，业务层再转数字，避免查询参数转换问题） */
    @IsOptional()
    @IsString()
    lines?: string;

    /** 级别筛选：INFO / WARN / ERROR / DEBUG / VERBOSE */
    @IsOptional()
    @IsString()
    level?: string;

    /** 关键字筛选 */
    @IsOptional()
    @IsString()
    keyword?: string;
}

/** 操作审计查询条件（对应前端的 searchForm.ep） */
export class AuditQueryDto {
    /** 关键字：匹配操作名、摘要、接口、返回消息 */
    @IsOptional()
    @IsString()
    keyword?: string;

    /** 操作人账号（模糊匹配） */
    @IsOptional()
    @IsString()
    username?: string;

    /** 操作名（精确匹配，来自审计统计接口） */
    @IsOptional()
    @IsString()
    action?: string;

    /** 结果筛选：true / false / 空 */
    @IsOptional()
    @IsString()
    success?: string;
}

/** 分页参数（对应前端的 searchForm.paging） */
export class PagingQueryDto {
    @IsOptional()
    @IsString()
    pageNumber?: string;

    @IsOptional()
    @IsString()
    pageSize?: string;
}

/** 操作审计列表查询 */
export class AuditListDto {
    @IsOptional()
    @ValidateNested()
    @Type(() => AuditQueryDto)
    ep?: AuditQueryDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => PagingQueryDto)
    paging?: PagingQueryDto;
}

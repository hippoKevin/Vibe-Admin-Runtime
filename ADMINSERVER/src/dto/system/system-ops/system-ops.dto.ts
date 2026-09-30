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

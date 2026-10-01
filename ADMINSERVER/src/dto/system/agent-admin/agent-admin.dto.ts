import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** 三类能力资产 */
export const ASSET_KINDS = ['skill', 'agent', 'tool'] as const;

/** 资产类型入参 */
export class AssetKindDto {
    @IsIn(ASSET_KINDS as unknown as string[], { message: 'kind 只能是 skill / agent / tool' })
    kind: string;
}

/** 资产详情/删除入参 */
export class AssetNameDto extends AssetKindDto {
    @IsString()
    @IsNotEmpty({ message: 'name 不能为空' })
    @MaxLength(64)
    name: string;
}

/** 详情入参：可指定查看目录内哪个文件，默认主文档 */
export class AssetDetailDto extends AssetNameDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    file?: string;
}

/** 保存文件入参 */
export class SaveAssetDto extends AssetNameDto {
    @IsString()
    @IsNotEmpty({ message: 'file 不能为空' })
    @MaxLength(200)
    file: string;

    @IsString()
    @MaxLength(262144, { message: '单个文件不能超过 256KB' })
    content: string;
}

/** 新建资产入参 */
export class CreateAssetDto extends AssetNameDto {
    @IsOptional()
    @IsString()
    @MaxLength(64)
    title?: string;
}

/** 启用/停用入参：默认改主文档，传了 file 就只改这个文件 */
export class SetAssetEnabledDto extends AssetNameDto {
    @IsBoolean({ message: 'enabled 必须是布尔值' })
    enabled: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    file?: string;
}

/** 在条目目录里新建目录 / 文件 */
export class CreateNodeDto extends AssetNameDto {
    /** 条目内相对目录，空表示条目根目录（例如 workflow） */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    parent?: string;

    /** dir = 目录 / file = 文件 */
    @IsIn(['dir', 'file'], { message: 'nodeType 只能是 dir 或 file' })
    nodeType: string;

    @IsString()
    @IsNotEmpty({ message: 'nodeName 不能为空' })
    @MaxLength(64)
    nodeName: string;
}

/** AI 润色入参：file 为条目内相对路径，缺省润色主文档 */
export class PolishAssetDto extends AssetNameDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    file?: string;
}

/** 删除条目内的文件 / 子目录入参：path 为条目内相对路径 */
export class RemoveAssetNodeDto extends AssetNameDto {
    @IsString()
    @IsNotEmpty({ message: 'path 不能为空' })
    @MaxLength(200)
    path: string;
}

/** 润色进度入参：runId 为 polish 返回的运行 id */
export class PolishStatusDto extends AssetNameDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    file?: string;

    @IsString()
    @IsNotEmpty({ message: 'runId 不能为空' })
    @MaxLength(64)
    runId: string;
}

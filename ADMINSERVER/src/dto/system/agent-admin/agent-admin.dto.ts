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

/** 启用/停用入参：写进主文档顶部的 front matter（enabled: true/false） */
export class SetAssetEnabledDto extends AssetNameDto {
    @IsBoolean({ message: 'enabled 必须是布尔值' })
    enabled: boolean;
}

/** AI 润色入参：file 为条目内相对路径，缺省润色主文档 */
export class PolishAssetDto extends AssetNameDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    file?: string;
}

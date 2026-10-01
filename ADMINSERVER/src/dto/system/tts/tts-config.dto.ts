import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * TTS 管理页的参数 DTO
 *
 * 注意：这里只做「是不是大体对」的类型校验，
 * 数值范围 / 越界原因统一在 TtsService 里校验，这样错误信息能写中文并且带上具体范围。
 */

/** 保存配置：音色 + 语言 + 全部声音参数（也可以只提交其中一项，便于局部更新） */
export class SaveTtsConfigDto {
    /** 当前选中的参考音色（ADMINTTS/examples 下的文件名） */
    @IsOptional()
    @IsString()
    @MaxLength(128)
    voice?: string;

    /** 语言：ZH / EN / JA / AR / ES */
    @IsOptional()
    @IsString()
    @MaxLength(8)
    lang?: string;

    /** 声音参数（键名见 TtsService 的 PARAM_DEFS） */
    @IsOptional()
    @IsObject({ message: 'params 必须是对象' })
    params?: Record<string, string | boolean | number>;
}

/** 试听：文本 / 音色 / 语言 / 临时参数覆盖，全部可选（缺省用已保存的配置） */
export class TtsPreviewDto {
    @IsOptional()
    @IsString()
    @MaxLength(500, { message: '试听文本不能超过 500 字' })
    text?: string;

    @IsOptional()
    @IsString()
    @MaxLength(128)
    voice?: string;

    @IsOptional()
    @IsString()
    @MaxLength(8)
    lang?: string;

    @IsOptional()
    @IsObject({ message: 'params 必须是对象' })
    params?: Record<string, string | boolean | number>;
}

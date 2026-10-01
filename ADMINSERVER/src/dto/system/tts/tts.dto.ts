import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** 语音合成入参：文本必填，音色 / 语言 / 声音参数可选 */
export class TtsSynthesizeDto {
    @IsString()
    @IsNotEmpty({ message: 'text 不能为空' })
    @MaxLength(500, { message: '待合成文本不能超过 500 字' })
    text: string;

    /** 参考音色文件名（ADMINTTS/examples 下的 .wav），缺省用配置里选中的音色 */
    @IsOptional()
    @IsString()
    @MaxLength(128)
    voice?: string;

    /** 语言：ZH / EN / JA / AR / ES，缺省用配置里的语言 */
    @IsOptional()
    @IsString()
    @MaxLength(8)
    lang?: string;

    /**
     * 声音参数覆盖（emoWeight / vec1..8 / temperature 等）
     *
     * 不传就用 ADMINAGENT/tts-config.json 里保存的配置；
     * 范围校验在 TtsService 里做，非法值返回中文错误。
     */
    @IsOptional()
    @IsObject({ message: 'params 必须是对象' })
    params?: Record<string, string | boolean>;
}

/** 取回合成音频入参：file 为 ADMINTTS/outputs 下的文件名 */
export class TtsAudioDto {
    @IsString()
    @IsNotEmpty({ message: 'file 不能为空' })
    @MaxLength(128)
    file: string;
}

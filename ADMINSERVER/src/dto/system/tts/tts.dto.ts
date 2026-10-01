import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** 语音合成入参：文本必填，音色与语言可选 */
export class TtsSynthesizeDto {
    @IsString()
    @IsNotEmpty({ message: 'text 不能为空' })
    @MaxLength(500, { message: '待合成文本不能超过 500 字' })
    text: string;

    /** 参考音色文件名（ADMINTTS/examples 下的 .wav），缺省用默认音色 */
    @IsOptional()
    @IsString()
    @MaxLength(128)
    voice?: string;

    /** 语言：ZH / EN / JA / AR / ES，缺省 ZH */
    @IsOptional()
    @IsString()
    @MaxLength(8)
    lang?: string;
}

/** 取回合成音频入参：file 为 ADMINTTS/outputs 下的文件名 */
export class TtsAudioDto {
    @IsString()
    @IsNotEmpty({ message: 'file 不能为空' })
    @MaxLength(128)
    file: string;
}

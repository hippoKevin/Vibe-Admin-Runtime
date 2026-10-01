import { Body, Controller, Get, Post, Query, Res, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // JWT 验证
import { Response } from 'express';
import * as fs from 'fs';
import { TtsAudioDto, TtsSynthesizeDto } from 'src/dto/system/tts/tts.dto';
import { TtsService } from 'src/services/system/tts.service';

/**
 * 开发模式的语音合成（TTS）
 *
 * 把本机的 IndexTTS（Gradio WebUI，ADMINTTS/）包成稳定接口：
 * 前端「快速回复」通道拿到答复后优先合成并播放音频，失败再回退浏览器内置播报。
 *
 * 说明：这里只做登录校验。如要收紧，可参照 menu.controller.ts 补 @Permission(...)。
 */
@Controller('dev-agent/tts')
export class TtsController {
    constructor(private readonly ttsService: TtsService) {}

    /**
     * 状态：IndexTTS 是否可达、参考音色清单、默认音色
     *
     * 永远返回 200（不可达也是一种状态），前端据此决定用哪个引擎并给出一行提示。
     */
    @Get('/status')
    @UseGuards(AuthGuard('jwt'))
    getStatus() {
        return this.ttsService.getStatus();
    }

    /**
     * 合成语音：文本 → wav
     *
     * 返回 audioUrl（指向下面的 /tts/audio），前端直接用 new Audio(audioUrl) 播放。
     */
    @Post('/')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    synthesize(@Body() body: TtsSynthesizeDto) {
        return this.ttsService.synthesize(body.text, body.voice, body.lang);
    }

    /**
     * 取回合成音频：只允许 ADMINTTS/outputs 下的 .wav
     *
     * 必须流式返回（前端 <audio> 需要能直接消费），因此这里直接写 res。
     */
    @Get('/audio')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe({ transform: true }))
    getAudio(@Query() query: TtsAudioDto, @Res() res: Response) {
        // 路径校验失败会抛业务异常，由全局异常过滤器统一转成 JSON
        const { absolute, size } = this.ttsService.resolveAudioFile(query.file);

        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', String(size));
        // 合成结果是全新的文件，允许缓存一小段时间，避免同一段反复拖动进度条时重复请求
        res.setHeader('Cache-Control', 'private, max-age=300');
        // 音频会被 <audio> 直接消费，不要触发下载
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(query.file)}"`);

        const stream = fs.createReadStream(absolute);
        stream.on('error', () => {
            if (!res.headersSent) res.status(500).json({ code: 4000, msg: '读取音频失败', data: null });
            else res.end();
        });
        stream.pipe(res);
    }
}

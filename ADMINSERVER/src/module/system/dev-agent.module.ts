import { Module } from '@nestjs/common';
import { DevAgentController } from 'src/controller/system/dev-agent.controller';
import { TtsController } from 'src/controller/system/tts.controller';
import { DevAgentService } from 'src/services/system/dev-agent.service';
import { TtsService } from 'src/services/system/tts.service';

/**
 * 开发模式模块
 * 把一句话任务交给 DeepSeek Harness（dsh --profile headless）执行并改动本仓库代码
 *
 * 同时提供开发模式的语音合成（TTS）：把可选的本机 IndexTTS 服务桥接成稳定接口，
 * 供「快速回复」通道播报 Agent 的答复。
 */
@Module({
    controllers: [DevAgentController, TtsController],
    providers: [DevAgentService, TtsService],
    // 智能管理页要展示「开发模式是否就绪」，复用这里的探测逻辑
    exports: [DevAgentService],
})
export class DevAgentModule {}

import { Module } from '@nestjs/common';
import { DevAgentController } from 'src/controller/system/dev-agent.controller';
import { DevAgentService } from 'src/services/system/dev-agent.service';

/**
 * 开发模式模块
 * 把一句话任务交给 DeepSeek Harness（dsh --profile headless）执行并改动本仓库代码
 */
@Module({
    controllers: [DevAgentController],
    providers: [DevAgentService],
    // 智能管理页要展示「开发模式是否就绪」，复用这里的探测逻辑
    exports: [DevAgentService],
})
export class DevAgentModule {}

import { Module } from '@nestjs/common';
import { AgentAdminController } from 'src/controller/system/agent-admin.controller';
import { DevAgentModule } from 'src/module/system/dev-agent.module';
import { AgentAdminService } from 'src/services/system/agent-admin.service';

/**
 * 智能管理模块
 * 管理 ADMINAGENT 下的 skills / agent / tools 三类能力资产
 */
@Module({
    imports: [DevAgentModule],
    controllers: [AgentAdminController],
    providers: [AgentAdminService],
})
export class AgentAdminModule {}

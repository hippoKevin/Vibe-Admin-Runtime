import { Module } from '@nestjs/common';
import { SystemOpsController } from 'src/controller/system/system-ops.controller';
import { SystemOpsService } from 'src/services/system/system-ops.service';

/**
 * 系统运维模块
 * 关于系统 / 系统日志 / 环境变量（.env）维护与重启
 */
@Module({
    controllers: [SystemOpsController],
    providers: [SystemOpsService],
})
export class SystemOpsModule {}

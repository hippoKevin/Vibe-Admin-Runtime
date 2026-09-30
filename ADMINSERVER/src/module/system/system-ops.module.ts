import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLogInterceptor } from 'src/common/interceptors/operation-log.interceptor';
import { SystemOpsController } from 'src/controller/system/system-ops.controller';
import { OperationListEntity } from 'src/entities/system/operation.entity';
import { OperationLogEntity } from 'src/entities/system/other/operation_log.entity';
import { SystemOpsService } from 'src/services/system/system-ops.service';

/**
 * 系统运维模块
 * 关于系统 / 系统日志（操作审计）/ 环境变量（.env）维护与重启
 */
@Module({
    imports: [
        TypeOrmModule.forFeature(
            [OperationLogEntity, OperationListEntity],
            'etp_default_sql',
        ),
    ],
    controllers: [SystemOpsController],
    providers: [
        SystemOpsService,
        // 全局操作审计：自动记录所有写操作，新增接口无需额外代码
        { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor },
    ],
})
export class SystemOpsModule {}

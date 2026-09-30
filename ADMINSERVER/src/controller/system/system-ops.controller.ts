import { Body, Controller, Get, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // JWT 验证
import { Public } from 'src/common/decorators/public.decorator';
import { AuditListDto, ReadLogDto, SaveEnvDto } from 'src/dto/system/system-ops/system-ops.dto';
import { SystemOpsService } from 'src/services/system/system-ops.service';

/**
 * 系统运维
 *
 * 包含三块能力：
 * 1. 关于系统：服务端运行信息、资源占用、数据库连接情况
 * 2. 系统日志：日志文件列表、内容查看（级别 / 关键字筛选）、清空
 * 3. 环境配置：.env 文件读取与保存，保存后可一键重启系统
 *
 * 说明：这里只做了登录校验（全局 AuthGuard + 下面的 jwt 守卫）。
 * 如需按角色控制，可参照 menu.controller.ts 补上
 * @UseGuards(AuthGuard('jwt'), PermissionGuard) + @Permission('SystemOps.xxx')，
 * 并在「角色管理」里配置对应操作权限。
 */
@Controller('system-ops')
export class SystemOpsController {
    constructor(private readonly systemOpsService: SystemOpsService) {}

    /**
     * 服务存活探测（重启后前端轮询使用，无需登录）
     */
    @Public()
    @Get('/ping')
    ping() {
        return { alive: true, time: new Date().toISOString() };
    }

    // ==================== 关于系统 ====================

    /**
     * 关于系统
     */
    @Get('/about')
    @UseGuards(AuthGuard('jwt'))
    getAbout() {
        return this.systemOpsService.getAbout();
    }

    /**
     * 指标趋势（BI 看板折线图数据源）
     */
    @Get('/metrics')
    @UseGuards(AuthGuard('jwt'))
    getMetrics() {
        return this.systemOpsService.getMetrics();
    }

    // ==================== 系统日志 ====================

    /**
     * 日志文件列表
     */
    @Get('/log/files')
    @UseGuards(AuthGuard('jwt'))
    getLogFiles() {
        return this.systemOpsService.getLogFiles();
    }

    /**
     * 读取日志内容
     * @param query 文件名 / 行数 / 级别 / 关键字
     */
    @Get('/log/read')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    readLog(@Query() query: ReadLogDto) {
        return this.systemOpsService.readLog(query);
    }

    /**
     * 清空日志文件
     * @param file 日志文件名，不传则清空最新日志
     */
    @Post('/log/clear')
    @UseGuards(AuthGuard('jwt'))
    clearLog(@Body('file') file?: string) {
        return this.systemOpsService.clearLog(file);
    }

    /**
     * 操作审计列表（系统日志页面的主数据）
     * @param query 支持 ep（关键字/操作人/操作名/结果）与 paging
     */
    @Get('/audit/list')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    getAuditList(@Query() query: AuditListDto) {
        return this.systemOpsService.getAuditList(query);
    }

    /**
     * 操作类型下拉选项
     */
    @Get('/audit/actions')
    @UseGuards(AuthGuard('jwt'))
    getAuditActions() {
        return this.systemOpsService.getAuditActions();
    }

    // ==================== 环境配置 ====================

    /**
     * 环境变量文件详情（敏感项不回显）
     * @param file 文件名，不传则取当前生效的配置文件
     */
    @Get('/env/detail')
    @UseGuards(AuthGuard('jwt'))
    getEnvDetail(@Query('file') file?: string) {
        return this.systemOpsService.getEnvDetail(file);
    }

    /**
     * 保存环境变量文件，可选重启
     */
    @Post('/env/save')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    saveEnv(@Body() body: SaveEnvDto) {
        return this.systemOpsService.saveEnv(body);
    }

    /**
     * 重启系统
     */
    @Post('/restart')
    @UseGuards(AuthGuard('jwt'))
    restart() {
        return this.systemOpsService.restart();
    }
}

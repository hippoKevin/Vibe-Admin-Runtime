import { Body, Controller, Get, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AssetKindDto, AssetNameDto, CreateAssetDto, SaveAssetDto } from 'src/dto/system/agent-admin/agent-admin.dto';
import { AgentAdminService } from 'src/services/system/agent-admin.service';

/**
 * 智能管理（技能 / Agent / 工具）
 *
 * 说明：这些接口能直接读写仓库 ADMINAGENT 下的文件，
 * 目前只做登录校验；如要收紧，可参考 menu.controller.ts 加 @Permission(...)，
 * 并在「角色管理」里配置对应操作权限。
 */
@Controller('agent-admin')
export class AgentAdminController {
    constructor(private readonly agentAdminService: AgentAdminService) {}

    /**
     * 概览：三类资产数量、harness 版本、开发模式是否就绪
     */
    @Get('/overview')
    @UseGuards(AuthGuard('jwt'))
    getOverview() {
        return this.agentAdminService.getOverview();
    }

    /**
     * 列表
     * @param query kind=skill|agent|tool
     */
    @Get('/list')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe({ transform: true }))
    getList(@Query() query: AssetKindDto) {
        return this.agentAdminService.getList(query.kind);
    }

    /**
     * 详情：主文档内容 + 文件清单
     * @param query kind + name
     */
    @Get('/detail')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe({ transform: true }))
    getDetail(@Query() query: AssetNameDto) {
        return this.agentAdminService.getDetail(query.kind, query.name);
    }

    /**
     * 保存条目内的某个文件
     */
    @Post('/save')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    save(@Body() body: SaveAssetDto) {
        return this.agentAdminService.save(body.kind, body.name, body.file, body.content);
    }

    /**
     * 按模板新建条目
     */
    @Post('/create')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    create(@Body() body: CreateAssetDto) {
        return this.agentAdminService.create(body.kind, body.name, body.title);
    }

    /**
     * 删除条目（前端必须二次确认）
     */
    @Post('/remove')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    remove(@Body() body: AssetNameDto) {
        return this.agentAdminService.remove(body.kind, body.name);
    }
}

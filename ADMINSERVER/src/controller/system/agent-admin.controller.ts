import { Body, Controller, Get, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AssetDetailDto, AssetKindDto, AssetNameDto, CreateAssetDto, CreateNodeDto, PolishAssetDto, PolishStatusDto, RemoveAssetNodeDto, SaveAssetDto, SetAssetEnabledDto } from 'src/dto/system/agent-admin/agent-admin.dto';
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
     * 详情：指定文件（默认主文档）的内容 + 文件清单
     * @param query kind + name + 可选 file
     */
    @Get('/detail')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe({ transform: true }))
    getDetail(@Query() query: AssetDetailDto) {
        return this.agentAdminService.getDetail(query.kind, query.name, query.file);
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

    /**
     * 启用 / 停用：只改**当前这个文件**（写进它顶部的 front matter）
     */
    @Post('/enabled')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    setEnabled(@Body() body: SetAssetEnabledDto) {
        return this.agentAdminService.setEnabled(body.kind, body.name, body.enabled, body.file);
    }

    /**
     * 在条目目录里新建子目录 / 文件（例如在 Backend 下建 workflow 目录，再建 workflow.md）
     */
    @Post('/node')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    createNode(@Body() body: CreateNodeDto) {
        return this.agentAdminService.createNode(body.kind, body.name, body.parent, body.nodeType, body.nodeName);
    }

    /**
     * 删除条目里的一个文件 / 子目录（点哪个删哪个，不动条目本身）
     */
    @Post('/remove-node')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    removeNode(@Body() body: RemoveAssetNodeDto) {
        return this.agentAdminService.removeNode(body.kind, body.name, body.path);
    }

    /**
     * AI 润色：让 DSH 直接改写这份 md（保持结构、标题、表格与事实不变，只改措辞）
     *
     * 异步接口：一次润色约 100 秒，这里立刻返回 { started, runId }，
     * 前端拿 runId 轮询 /dev-agent/runs 看进度，跑完再刷新文件内容。
     */
    @Post('/polish')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    polish(@Body() body: PolishAssetDto) {
        return this.agentAdminService.polish(body.kind, body.name, body.file);
    }

    /**
     * 润色进度：前端拿 polish 返回的 runId 轮询这里
     *
     * 返回运行状态（running/ok/error/耗时）+ 该文件最新字节数，
     * 前端据此显示「润色中… 37s」并在结束后判定是否真的被改写。
     */
    @Get('/polish/status')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe({ transform: true }))
    polishStatus(@Query() query: PolishStatusDto) {
        return this.agentAdminService.getPolishStatus(query.kind, query.name, query.file, query.runId);
    }
}

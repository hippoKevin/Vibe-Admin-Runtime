import { Body, Controller, Get, Post, Res, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // JWT 验证
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Public } from 'src/common/decorators/public.decorator';
import { GenerateCodeDto } from 'src/dto/system/dev-agent/dev-agent.dto';
import { DevAgentService } from 'src/services/system/dev-agent.service';

/**
 * 开发模式（语音/文本 → DSH 生成代码）
 *
 * 说明：这里只做登录校验。该接口会驱动 Agent 修改本仓库代码，
 * 如要收紧权限，可参照 menu.controller.ts 补 @Permission('DevAgent.generate')，
 * 并在「角色管理」里配置对应操作权限。
 */
@Controller('dev-agent')
export class DevAgentController {
    constructor(private readonly devAgentService: DevAgentService) {}

    /**
     * 开发模式状态：dsh 是否就绪、最近一次执行结果
     */
    @Get('/status')
    @UseGuards(AuthGuard('jwt'))
    getStatus() {
        return this.devAgentService.getStatus();
    }

    /**
     * 执行历史：控制台「执行过程」面板用
     */
    @Get('/runs')
    @UseGuards(AuthGuard('jwt'))
    getRuns() {
        return this.devAgentService.getRuns();
    }

    /**
     * 执行一次生成任务
     * @param body 任务描述（开发模式里由语音转写而来）
     */
    @Post('/generate')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    generate(@Body() body: GenerateCodeDto) {
        return this.devAgentService.generate(body);
    }

    /**
     * 独立的「开发模式控制台」页面
     *
     * 刻意放在前端应用之外（由后端直接吐一个独立页面）：
     * Agent 一改前端代码就会触发 Vite 热更新甚至整页刷新，
     * 控制台如果跑在应用里，每次生成都会被刷掉、开发模式被迫关闭。
     * 页面本身无需登录（token 由主窗口通过 URL hash 传进来），
     * 但页面里调用的接口仍然要带 token，所以外人拿到这个 HTML 也驱动不了 Agent。
     */
    @Get('/console')
    @Public()
    console(@Res() res: Response) {
        const candidates = [
            path.join(process.cwd(), 'public', 'dev-agent-console.html'),
            path.join(process.cwd(), '..', 'public', 'dev-agent-console.html'),
            path.join(__dirname, '..', '..', '..', 'public', 'dev-agent-console.html'),
        ];
        const file = candidates.find((item) => fs.existsSync(item));

        if (!file) {
            res.status(404).type('text/plain; charset=utf-8').send('未找到 public/dev-agent-console.html');
            return;
        }

        res.type('html').send(fs.readFileSync(file, 'utf-8'));
    }
}

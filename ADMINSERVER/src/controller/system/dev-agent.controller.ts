import { Body, Controller, Get, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport'; // JWT 验证
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
     * 执行一次生成任务
     * @param body 任务描述（开发模式里由语音转写而来）
     */
    @Post('/generate')
    @UseGuards(AuthGuard('jwt'))
    @UsePipes(new ValidationPipe())
    generate(@Body() body: GenerateCodeDto) {
        return this.devAgentService.generate(body);
    }
}

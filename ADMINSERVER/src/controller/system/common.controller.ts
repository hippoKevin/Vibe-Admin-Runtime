import { Controller, Post, Body, UsePipes, ValidationPipe, Get, Request } from "@nestjs/common";
import { CommonService } from "../../services/system/common.service";
import { AddUserDto } from "src/dto/system/user/add-user.dto";
import { LoginDto } from "src/dto/system/login.dto";
import { Public } from "src/common/decorators/public.decorator";

@Controller('common')
export class CommonController {
    constructor(private readonly commonService: CommonService) {}

    /**
     * 登录接口（POST请求）
     * @param loginDto 登录参数
     */
    @Public()
    @Post('/login') // 登录建议用POST，更安全（GET参数会暴露在URL中）
    @UsePipes(new ValidationPipe())
    login(@Body() loginDto: LoginDto) {
        return this.commonService.login(loginDto);
    }

    /**
     * 鉴权
     * @param token 鉴权参数W
     */
    @Public()
    @Post('/verifyToken')
    async checkToken(@Request() req) {
        // 调用服务中的Token验证方法
        const userInfo = await this.commonService.verifyToken(req);
        return { message: 'Token验证成功', userInfo };
    }

    /**
     * 刷新Token
     * @param token 刷新Token参数
     */
    @Post('/refresh_token')
    async refreshToken(@Request() req) {
        // 调用服务中的Token刷新方法
        return this.commonService.refreshToken(req);
    }

    /**
     * 恢复默认
     * refersh_default
     */
    @Post('/refresh_default')
    async refreshDefault() {
        // 恢复数据库默认状态
        return this.commonService.refreshDefault();
    }
}
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Observable } from "rxjs";
import { Request } from "express";
import { IS_PUBLIC_KEY } from "./decorators/public.decorator";
import { BusinessException } from "./exceptions/business.exception";

// CanActivate 是 NestJS 提供的抽象类，用于定义自定义的守卫（Guard）。
@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private jwtService: JwtService, // 注入JWT服务
        private reflector: Reflector // 注入反射器 用于获取元数据（元数据表示存储在类、方法、属性、参数等中的额外信息）
    ){}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        // 1.检查接口是否为公开接口
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(), // 当前处理函数
            context.getClass() // 当前类
        ]);

        if (isPublic) return true;

        // 2.不是公开接口，获取请求对象
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (!token) throw new BusinessException('请先登录');

        // 3.验证token
        try {
            // 验证token是否有效
            const payload = this.jwtService.verify(token);
            // 添加用户信息
            request['user'] = payload;
        } catch (error) {
            throw new BusinessException('登录过期', 4001);
        }

        return true
    }

    // 提取token
    private extractTokenFromHeader(request: Request): string | undefined { 
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
// src/common/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'src/services/system/common.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor() {
        super({
            // 从 Authorization: Bearer <token> 中提取
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET ?? 'hippoadmin', // 和 JwtModule 里的 secret 保持一致
        });
    }

    // token 验证通过后，payload 会挂到 request.user 上
    async validate(payload: JwtPayload) {
        return {
            user_id: payload.sub,
            username: payload.username,
            role_id: payload.role_id,
        };
    }
}
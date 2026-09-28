// src/guards/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleMenuEntity } from 'src/entities/system/role_auth.entity';
import { RoleOperationEntity } from 'src/entities/system/role_operation.entity';
import { BusinessException } from '../exceptions/business.exception';

// 自定义装饰器 key
export const PERMISSION_KEY = 'permission';

// 定义权限装饰器
export const Permission = (operationAlias: string) =>
    SetMetadata(PERMISSION_KEY, { operationAlias });

@Injectable()
export class AuthGuard implements CanActivate {

    constructor(
        private reflector: Reflector,
        @InjectRepository(RoleOperationEntity, 'etp_default_sql')
        private roleOperationRepository: Repository<RoleOperationEntity>,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const permission = this.reflector.get<{
            operationAlias: string
        }>(PERMISSION_KEY, context.getHandler());
    
        if (!permission) return true; // 没有声明直接放行
    
        const request = context.switchToHttp().getRequest();
        const user = request.user;
    
        // 只判断操作权限
        const roleOp = await this.roleOperationRepository.findOne({
            where: {
                role_id: user.role_id,
                operation_code: permission.operationAlias
            }
        });
    
        if (!roleOp) {
            throw new BusinessException('暂无该操作权限', 4003);
        }
    
        return true;
    }
}
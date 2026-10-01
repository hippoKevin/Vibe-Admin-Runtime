import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommonController } from "src/controller/system/common.controller";
import { UserEntity } from "src/entities/system/user.entity";
import { CommonService } from "src/services/system/common.service";
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthGuard } from "src/common/verify-token";
import { APP_GUARD } from "@nestjs/core";
import { MenuEntity } from "src/entities/system/menu.entity";
import { OperationListEntity } from "src/entities/system/operation.entity";
import { MenuService } from "src/services/system/menu.service";
import { ToolService } from "src/common/services/tools.service";
import { TreePaginatedQuery } from "src/common/services/treePagination.service";
import { RoleMenuEntity } from "src/entities/system/role_auth.entity";
import { MenuStatusEntity } from "src/entities/system/other/menu_status.entities";
import { PaginationService } from "src/common/services/pagination.service";
import { ExcelService } from "src/services/system/tools/excel.service";
import { ExcelController } from "src/controller/system/tools/excel.controller";
import { ImportHistoryEntity } from "src/entities/system/other/import_history.entity";
import { RoleOperationEntity } from "src/entities/system/role_operation.entity";
import { FileEntity } from "src/entities/system/file/file.entity";
import { FilesService } from "src/services/system/file/file.service";

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.development' }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        // 全项目唯一的 JwtModule 注册处（含全局守卫 AuthGuard 与 CommonService 的 JwtService）。
        // 过期时间 = 12h：这是历史上真正生效的值（实测登录 token 的 exp - iat = 43200s），
        // 之所以是这个值，是因为守卫和 CommonService 都在本模块内，注入的是本模块的 JwtService；
        // app.module.ts 里曾经那份 expiresIn:'1h' 的注册从未被任何 provider 使用，已删除。
        // 如需调整登录有效期，只改这里（同时注意 secret 读取的是 .env.development 的 JWT_SECRET）。
        JwtModule.registerAsync({
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: '12h' },
            }),
            inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([
            UserEntity,
            MenuEntity,
            OperationListEntity,
            RoleMenuEntity,
            MenuStatusEntity,
            ImportHistoryEntity,
            RoleOperationEntity,
            FileEntity
        ], 'etp_default_sql'),
    ],
    controllers: [
        CommonController,
        ExcelController,
    ],
    providers: [
        CommonService,
        MenuService,
        ToolService,
        TreePaginatedQuery,
        PaginationService,
        ExcelService,
        FilesService,
        { provide: APP_GUARD, useClass: AuthGuard }
    ],
    exports: [
        TypeOrmModule,
        CommonService,
        ToolService,
        MenuService,
        TreePaginatedQuery,
        PaginationService,
        ExcelService,
        FilesService
    ],
})
export class CommonModule { }
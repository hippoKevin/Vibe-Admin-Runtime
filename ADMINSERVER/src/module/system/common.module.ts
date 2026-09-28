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
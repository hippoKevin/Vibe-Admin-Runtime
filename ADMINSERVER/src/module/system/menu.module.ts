import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MenuController } from "src/controller/system/menu.controller";
import { MenuEntity } from "src/entities/system/menu.entity";
import { OperationListEntity } from "src/entities/system/operation.entity";
import { RoleMenuEntity } from "src/entities/system/role_auth.entity";
import { RoleOperationEntity } from "src/entities/system/role_operation.entity";
import { UserEntity } from "src/entities/system/user.entity";
import { MenuStatusEntity } from "src/entities/system/other/menu_status.entities";
import { MenuService } from "src/services/system/menu.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([MenuEntity, 
            OperationListEntity, 
            UserEntity,
            RoleMenuEntity, 
            RoleOperationEntity,
            MenuStatusEntity,
        ], 'etp_default_sql'),
    ],
    controllers: [MenuController],
    providers: [MenuService],
})
export class MenuModule {}
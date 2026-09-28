import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaginationService } from "src/common/services/pagination.service";
import { RoleController } from "src/controller/system/role.controller";
import { OperationListEntity } from "src/entities/system/operation.entity";
import { RoleEntity } from "src/entities/system/role.entity";
import { RoleMenuEntity } from "src/entities/system/role_auth.entity";
import { RoleOperationEntity } from "src/entities/system/role_operation.entity";
import { RoleService } from "src/services/system/role.service";


@Module({
    imports: [
        TypeOrmModule.forFeature([RoleEntity,RoleOperationEntity,RoleMenuEntity, OperationListEntity], 'etp_default_sql')
    ],
    controllers: [RoleController],
    providers: [RoleService, PaginationService],
})
export class RoleModule {}
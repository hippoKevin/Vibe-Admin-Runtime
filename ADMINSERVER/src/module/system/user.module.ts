import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaginationService } from "src/common/services/pagination.service";
import { UserController } from "src/controller/system/user.controller";
import { RoleMenuEntity } from "src/entities/system/role_auth.entity";
import { RoleOperationEntity } from "src/entities/system/role_operation.entity";
import { UserEntity } from "src/entities/system/user.entity";
import { UserService } from "src/services/system/user.service";


@Module({
    imports: [
        TypeOrmModule.forFeature([UserEntity,RoleMenuEntity,RoleOperationEntity], 'etp_default_sql'),
    ],
    controllers: [UserController],
    providers: [UserService, PaginationService],
})

export class UserModule {}
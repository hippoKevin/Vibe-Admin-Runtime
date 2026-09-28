import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { RoleEntity } from "src/entities/system/role.entity";
import { In, Repository } from "typeorm";
import { SearchForm, PaginatedResult } from "src/common/types/pagination.types";
import { PaginationService } from "src/common/services/pagination.service";
import { addRoleDto, ConfigRoleAuthDto, UpdateRoleDto } from "src/dto/system/role/role.dto";
import { RoleMenuEntity } from "src/entities/system/role_auth.entity";
import { RoleOperationEntity } from "src/entities/system/role_operation.entity";
import { OperationListEntity } from "src/entities/system/operation.entity";


@Injectable()
export class RoleService { 
    
    constructor(
        // 菜单数据仓库
        @InjectRepository(RoleEntity, 'etp_default_sql')
        private readonly roleRepository: Repository<RoleEntity>,
        @InjectRepository(RoleMenuEntity, 'etp_default_sql')
        private readonly roleMenuRepository: Repository<RoleMenuEntity>,

        // 新增注入
        @InjectRepository(RoleOperationEntity, 'etp_default_sql')
        private readonly roleOperationRepository: Repository<RoleOperationEntity>,

        @InjectRepository(OperationListEntity, 'etp_default_sql')
private readonly operationListRepository: Repository<OperationListEntity>,

        private readonly paginationService: PaginationService
    ) {}

    /**
     * 获取角色列表
     * @returns 角色列表
     */
    async getRoleList(searchForm: SearchForm): Promise<PaginatedResult<RoleEntity>> {
        return this.paginationService.paginate(this.roleRepository, searchForm);
    }

    /**
     * 删除角色
     */
    async deleteRole(role_id: number) {
        if (!role_id) {
            throw new Error('角色ID不能为空');
        }
    
        await Promise.all([
            this.roleMenuRepository.delete({ role_id: role_id }),
            this.roleOperationRepository.delete({ role_id: role_id }),
        ]);
    
        return await this.roleRepository.delete({ role_id: role_id });
    }

    /**
     * 获取角色信息
     */
    async getRoleInfo(role_id: number) {
        return await this.roleRepository.findOne({
            where: {
                role_id: role_id
            }
        });
    }

    /**
     * 添加角色
     */
    async addRole(addRoleDto: addRoleDto) {
        return await this.roleRepository.save(addRoleDto);
    }

    /**
     * 修改角色
     */
    async updateRole(role_id:number, updateRoleDto: UpdateRoleDto) {
        return await this.roleRepository.update(role_id, updateRoleDto);
    }

   /**
     * 获取角色权限列表
     */
    async getRoleAuthList(role_id: number) {
        const [roleMenus, roleOperations] = await Promise.all([
            this.roleMenuRepository.find({ where: { role_id } }),
            this.roleOperationRepository.find({ where: { role_id } }),
        ]);

        return {
            menuIds:      roleMenus.map(rm => rm.menu_id),
            operationIds: roleOperations.map(ro => ro.operation_id),
        };
    }

    /**
     * 配置角色权限
     */
    async configRoleAuth(role_id: number, configRoleAuthDto: ConfigRoleAuthDto) {
        const { menuIds = [], operationIds = [] } = configRoleAuthDto;
    
        // -------- 菜单权限差量更新 --------
        const existMenus = await this.roleMenuRepository.find({ where: { role_id } });
        const existMenuIds = existMenus.map(m => m.menu_id);
    
        const menuToAdd = menuIds.filter(id => !existMenuIds.includes(id));
        const menuToDelete = existMenuIds.filter(id => !menuIds.includes(id));
    
        // -------- 操作权限差量更新（含 operation_code 填充）--------
        const existOps = await this.roleOperationRepository.find({ where: { role_id } });
        const existOpIds = existOps.map(o => o.operation_id);
    
        const opToAdd = operationIds.filter(id => !existOpIds.includes(id));
        const opToDelete = existOpIds.filter(id => !operationIds.includes(id));
    
        // 查询新增操作对应的 operation_code
        let opEntities: OperationListEntity[] = [];
        if (opToAdd.length > 0) {
            opEntities = await this.operationListRepository.findBy({
                operation_id: In(opToAdd) 
            });
        }
    
        // 并行执行删除 + 插入
        await Promise.all([
            // 菜单：删除移除的
            menuToDelete.length > 0
                ? this.roleMenuRepository.delete({ role_id, menu_id: In(menuToDelete) })
                : Promise.resolve(),
    
            // 菜单：插入新增的
            menuToAdd.length > 0
                ? this.roleMenuRepository.save(
                    menuToAdd.map(menu_id => ({ role_id, menu_id }))
                  )
                : Promise.resolve(),
    
            // 操作：删除移除的
            opToDelete.length > 0
                ? this.roleOperationRepository.delete({ role_id, operation_id: In(opToDelete) })
                : Promise.resolve(),
    
            // 操作：插入新增的（带 operation_code）
            opToAdd.length > 0
                ? this.roleOperationRepository.save(
                    opToAdd.map(operation_id => {
                        const matched = opEntities.find(e => e.operation_id === operation_id);
                        return {
                            role_id,
                            operation_id,
                            operation_code: matched?.operation_sign ?? null,
                        };
                    })
                  )
                : Promise.resolve(),
        ]);
    
        return { message: '权限配置成功' };
    }
}
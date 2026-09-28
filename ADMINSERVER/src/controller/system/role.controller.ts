import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Public } from "src/common/decorators/public.decorator";
import { AuthGuard as PermissionGuard, Permission } from "src/common/guards/auth.guard";
import { SearchForm } from "src/common/types/pagination.types";
import { addRoleDto, ConfigRoleAuthDto, UpdateRoleDto } from "src/dto/system/role/role.dto";
import { RoleService } from "src/services/system/role.service";


@Controller('role')
export class RoleController {
    constructor(
        private readonly roleService: RoleService
    ) {
        
    }

    /**
     * 获取角色列表
     * @method GET
     * 
     * @returns 角色列表
     */
    @Public()
    @Get('/list')
    async getRoleList(
        @Query() searchForm: SearchForm
    ) {
        // 获取角色列表
        return await this.roleService.getRoleList(searchForm);
    }

    /**
     * 删除角色
     */
    @Post('/delete/:roleId')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('AuthAdminPage.delete')
    async deleteRole(
        @Param('roleId') role_id: number
    ) {
        // 删除角色
        return await this.roleService.deleteRole(role_id);
    }

    /**
     * 添加角色
     */
    @Post('/add')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('AuthAdminPage.add')
    async addRole(
        @Body() addRoleDto: addRoleDto
    ) {
        // 添加角色
        return await this.roleService.addRole(addRoleDto);
    }

    /**
     * Gaining role detail
     * 获取角色详情
     */
    @Get('/:role_id') 
    async roleDetail(
      @Param('role_id') role_id: number, 
    ) {
        return await this.roleService.getRoleInfo(role_id);
    }

    /**
     * 修改角色
     */
    @Post('/update/:role_id')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('AuthAdminPage.update')
    async updateRole(
        @Param('role_id') role_id: number,
        @Body() updateRoleDto: UpdateRoleDto
    ) {
        // 修改角色
        return await this.roleService.updateRole(role_id, updateRoleDto);
    }

    /**
     * ===================
     * 权限相关
     * ===================
     */

   /**
     * 获取角色权限列表
     */
    @Get('/auth/:role_id')
    async getRoleAuthList(@Param('role_id') role_id: number) {
        return await this.roleService.getRoleAuthList(role_id);
    }

    /**
     * 配置角色权限
     */
    @Post('/auth/config/:role_id')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('AuthAdminPage.setAuth')
    async configRole(
        @Param('role_id') role_id: number,
        @Body() configRoleDto: ConfigRoleAuthDto,
    ) {
        return await this.roleService.configRoleAuth(role_id, configRoleDto);
    }
}

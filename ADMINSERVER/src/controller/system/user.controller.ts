import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";                        
import { AuthGuard as PermissionGuard, Permission } from "src/common/guards/auth.guard"; // 权限验证
import { ChagnePasswordDTO } from "src/dto/system/user/change-password.dto";
import { UpdateUserDto } from "src/dto/system/user/update-user.dto";
import { CreateUserDto } from "src/dto/system/user/create_user.dto";
import { UserService } from "src/services/system/user.service";


@Controller('user')
export class UserController {
    
    constructor(private readonly userService: UserService) {}

    // 获取用户列表
    @Get('list')
    @UseGuards(AuthGuard('jwt'))   // ① JWT验证 → ② 菜单/操作权限验证
    async getUserList(@Query() searchForm: any) {
        const userList: any = await this.userService.getUserList(searchForm);
        return userList;
    }

    /**
     * add UserInfo
     * @param  CreateUserDto 新增用户信用
     */
    @Post('add')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('UserAdminPage.add')
    async addUser(
        @Body() createUserDto: CreateUserDto
    ) {
        // 添加用户信息
        const addResult: any = await this.userService.addUser(createUserDto);
        // 返回添加结果
        return addResult;
    }

    // 获取个人信息
    @Get(':userId/info')
    @UseGuards(AuthGuard('jwt'))
    getUserInfo(
        @Param('userId', ParseIntPipe) userId: number
    ) {
        return this.userService.getUserInfo(userId);
    }

    /**
     * 修改指定用户的密码
     * @param userId 用户ID
     * @param passwordDto 密码修改参数（请求体）
     * @returns 修改结果
   */
    @Post(':userId/changePassword') // 修复路径参数语法
    @UseGuards(AuthGuard('jwt'))
    updatePassword(
      @Param('userId', ParseIntPipe) userId: number, // 路径参数：用户ID
      @Body() passwordDto: ChagnePasswordDTO // 请求体：原密码+新密码
    ) {
      // 传递 userId 和密码参数给服务层
      return this.userService.changePassword(userId, passwordDto);
    }

    /**
     * 修改用户信息
     * @param userId 用户ID
     * @param UpdateUserDto 修改用户信息
     * @returns 修改用户信息结果
     */
    @Post(':userId/update')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('UserAdminPage.update')
    async updateUserInfo(
      @Param('userId') userId: number, // 路径参数：用户ID
      @Body() updateUserDto: UpdateUserDto // 请求体：修改用户信息
    ) {
      // 传递 userId 和修改用户信息参数给服务层
      return this.userService.updateUserInfo(userId, updateUserDto);
    }

    /**
     * 删除用户
     * @param userId 用户ID
     * @returns 删除结果
     */
    @Post(':userId/delete')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('UserAdminPage.delete')
    async deleteUser(
      @Param('userId', ParseIntPipe) userId: number // 删除用户ID
    ) {
      // 删除用户
      return this.userService.deleteUser(userId);
    }
}

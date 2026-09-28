import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";                        // JWT 验证
import { AuthGuard as PermissionGuard, Permission } from "src/common/guards/auth.guard"; // 权限验证
import { Public } from "src/common/decorators/public.decorator";
import { ShowDataNum } from "src/common/decorators/showDataNum.decorators";
import {  CreateMenuDto, CreateOperationDto, UpdateMenuDto, UpdateMenuStatusDto } from "src/dto/system/menu/menu.dto";
import { MenuService } from "src/services/system/menu.service";


@Controller('menu')
export class MenuController {
    constructor(private readonly menuService: MenuService) {

    }

    // 获取菜单列表
    @ShowDataNum()
    @Get('/list')
    @UseGuards(AuthGuard('jwt'))
    getMenuList(
        @Query() searchForm: any
    ) {
        return this.menuService.getMenuList(searchForm);
    }

    /**
     * Gaining authorization menu list
     * 获取菜单内的可操作元素
     */
    

    // 添加菜单
    @Post('/addMenu')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('MenuManagement.add')
    @UsePipes(new ValidationPipe())
    addMenu(@Body() CreateMenuDto: CreateMenuDto) {
        return this.menuService.addMenu(CreateMenuDto);
    }

    // 删除菜单
    @Get('/delete') 
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('MenuManagement.delete')
    deleteMenu(@Query('menuId') menuId: number) { // 指定查询参数名menuId
      if (!menuId) {
        throw new Error('menuId不能为空');
      }
      return this.menuService.deleteMenu(menuId);
    }

    // 修改菜单
    @Post('/updateMenu')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('MenuManagement.update')
    @UsePipes(new ValidationPipe())
    updateMenu(@Body() UpdateMenuDto: UpdateMenuDto) {
        return this.menuService.updateMenu(UpdateMenuDto);
    }

    // 获取指定id菜单信息
    @Get('/getMenuById')
    getMenuById(@Query('menuId') menuId: number) { 
        return this.menuService.getMenuById(menuId);
    }

    // 获取菜单下的选项框
    @Get('/options/:user_id')
    @UseGuards(AuthGuard('jwt'))
    getMenuOptions(
        @Param('user_id', ParseIntPipe) user_id: number
    ) {
        return this.menuService.getMenuOptions(user_id);
    }

    /**
     * 获取菜单列模板列表（分页 + 按菜单名搜索）
     * POST /menu/status/list
     */
    @Get('/status/list')
    @UseGuards(AuthGuard('jwt'))
    getMenuStatusList(@Query() searchForm: any) {
        return this.menuService.getMenuStatusList(searchForm);
    }

    /**
     * 获取指定菜单的列模板
     * GET /menu/status/:menu_id
     */
    @Get('/status/:menu_id')
    @UseGuards(AuthGuard('jwt'))
    getMenuStatus(@Param('menu_id', ParseIntPipe) menu_id: number) {
        return this.menuService.getMenuStatus(menu_id);
    }

    /**
     * 新增菜单列模板
     * POST /menu/status/save
     */
    @Post('/status/save')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('MenuSetting.add')
    @UseGuards(AuthGuard('jwt'))
    saveMenuStatus(@Body() body: { menu_id: number; column_config: any[] }) {
        return this.menuService.saveMenuStatus(body.menu_id, body.column_config);
    }

    /**
     * 更新指定菜单列模板
     * POST /menu/status/:menu_status_id
     */
    @Post('/status/update/:menu_status_id')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('MenuSetting.update')
    @UsePipes(new ValidationPipe())
    updateMenuStatus(
        @Param('menu_status_id', ParseIntPipe) menu_status_id: number,
        @Body() updateMenuStatusDto: UpdateMenuStatusDto,
    ) {
        return this.menuService.updateMenuStatus(menu_status_id, updateMenuStatusDto);
    }

    /**
     * 删除指定菜单的列模板配置（恢复默认）
     * DELETE /menu/status/:menu_status_id
     */
    @Post('/status/delete/:menu_status_id')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('MenuSetting.delete')
    @UseGuards(AuthGuard('jwt'))
    deleteMenuStatus(@Param('menu_status_id', ParseIntPipe) menu_status_id: number) {
        return this.menuService.deleteMenuStatus(menu_status_id);
    }

    /** ==================================
     * 
     * 操作模块
     * 
     * ==================================
     */

    // 获取菜单下的操作列表
    @Get('/getOperationList')
    @Public()
    getOperationList(@Query('menuId') menuId: number) {
    return this.menuService.getOperationList(menuId);
    }

    // 添加操作
    @Post('/addOperation')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('MenuManagement.addOperation')
    @UsePipes(new ValidationPipe())
    addOperation(@Body() createOperationDto: CreateOperationDto) {
    return this.menuService.addOperation(createOperationDto);
    }
s
    // 删除操作
    @Get('/deleteOperation')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('MenuManagement.deleteOperation')
    deleteOperation(@Query('operationId') operationId: number) {
    if (!operationId) throw new Error('operationId不能为空');
    return this.menuService.deleteOperation(operationId);
    }
}

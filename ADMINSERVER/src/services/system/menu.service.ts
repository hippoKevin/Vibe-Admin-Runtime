import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CreateMenuDto, CreateOperationDto, UpdateMenuDto, UpdateMenuStatusDto } from "src/dto/system/menu/menu.dto";
import { MenuEntity } from "src/entities/system/menu.entity";
import { In, IsNull, Repository } from "typeorm";
import { OperationListEntity } from "src/entities/system/operation.entity";
import { PaginatedResult, SearchForm } from "src/common/types/pagination.types";
import { TreePaginatedQuery } from "src/common/services/treePagination.service";
import { RoleMenuEntity } from "src/entities/system/role_auth.entity";
import { UserEntity } from "src/entities/system/user.entity";
import { ColumnConfig, MenuStatusEntity } from "src/entities/system/other/menu_status.entities";
import { PaginationService } from "src/common/services/pagination.service";

/**
 * 菜单数据结构（扩展children用于树形结构）
 */
export interface MenuData {
  menu_id: number;
  menu_name: string;
  menu_icon: string;
  component_name: string;
  component_address: string;
  menu_type: number;
  is_cached: boolean;
  parent_id: number;
  is_show: boolean;
  menu_remark: string;
  role_name?: number;
  children?: MenuData[];
  operationChildren?: any[];
}

// 权限管理页的默认列配置（与前端 tableColumns 初始值保持一致）
const DEFAULT_ROLE_COLUMNS: ColumnConfig[] = [
  { colKey: 'index', title: '序号', width: 80, align: 'center', fixed: 'left', visible: true, displayIndex: 0 },
  { colKey: 'role_name', title: '权限名称', width: 170, align: 'center', visible: true, displayIndex: 1 },
  { colKey: 'role_unit', title: '归属单位', width: 170, align: 'center', visible: true, displayIndex: 2 },
  { colKey: 'role_dept', title: '归属部门', width: 170, align: 'center', visible: true, displayIndex: 3 },
  { colKey: 'role_desc', title: '备注', width: 180, align: 'center', visible: true, displayIndex: 4 },
  { colKey: 'actions', title: '操作', width: 260, align: 'center', fixed: 'right', visible: true, displayIndex: 5 },
]

@Injectable()
export class MenuService {

  constructor(
    @InjectRepository(MenuEntity, 'etp_default_sql')
    private readonly menuRepository: Repository<MenuEntity>,

    @InjectRepository(OperationListEntity, 'etp_default_sql')
    private readonly operationRepository: Repository<OperationListEntity>,

    @InjectRepository(UserEntity, 'etp_default_sql')
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(RoleMenuEntity, 'etp_default_sql')
    private readonly roleMenuRepository: Repository<RoleMenuEntity>,

    @InjectRepository(MenuStatusEntity, 'etp_default_sql')
    private readonly menuStatusRepository: Repository<MenuStatusEntity>,

    private readonly paginationService: PaginationService,

    private readonly treePaginatedQuery: TreePaginatedQuery,
  ) { }

  /**
   * 获取菜单列表
   * @returns 结构化的菜单数组
   */
  async getMenuList(searchForm: any): Promise<PaginatedResult<MenuData>> {
    return this.treePaginatedQuery.queryWithTransform<MenuData>(
      // fetchDataFunc：只拉菜单原始数据 + 按 menu_sort 正序排列
      () => this.menuRepository.find({
        order: {
          menu_sort: 'ASC', // 👈 就加这一行！按排序号从小到大
        }
      }).then(list =>
        (list ?? []).map(menu => ({
          menu_id: menu.menu_id,
          menu_name: menu.menu_name,
          menu_icon: menu.menu_icon,
          component_name: menu.component_name,
          component_address: menu.component_address,
          menu_type: menu.menu_type,
          is_cached: menu.is_cached,
          parent_id: menu.parent_id,
          is_show: menu.is_show,
          menu_remark: menu.menu_remark,
          menu_sort: menu.menu_sort,
          operationChildren: [],
        }))
      ),

      searchForm,

      // transformFunc：拿到过滤后的菜单列表，再挂载对应的 operationChildren
      async (filteredMenuList) => {
        // 只查过滤后菜单涉及的操作，而非全量
        const filteredIds = filteredMenuList.map(m => m.menu_id);
        const operations = await this.operationRepository.findBy({
          menu_id: In(filteredIds),   // TypeORM In 操作符
        });

        // 建立 menu_id → operations 映射
        const operationMap = new Map<number, any[]>();
        operations.forEach(op => {
          if (!operationMap.has(op.menu_id)) operationMap.set(op.menu_id, []);
          operationMap.get(op.menu_id)!.push(op);
        });

        // 挂载到每个菜单节点
        return filteredMenuList.map(menu => ({
          ...menu,
          operationChildren: operationMap.get(menu.menu_id) ?? [],
        }));
      },

      "parent_id",  // parentIdField
      0,            // rootValue
      "menu_id",    // primaryKey
    );
  }

  /**
   * @param createMenuDto 菜单数据
   * @returns 添加菜单
   */
  async addMenu(createMenuDto: CreateMenuDto) {
    let parentMenu = null;
    if (createMenuDto.menu_type !== 0) {
      parentMenu = await this.menuRepository.findOne({
        where: { menu_id: createMenuDto.parent_id },
      });
      if (!parentMenu) {
        throw new NotFoundException('父级菜单不存在,请刷新后重试');
      }
    }

    if (parentMenu && parentMenu.menu_type === 1) {
      const parentDirectory = await this.menuRepository.findOne({
        where: { menu_id: parentMenu.parent_id },
      });

      if (parentDirectory) {
        parentDirectory.menu_type = 0;
        parentDirectory.component_name = null;
        parentDirectory.component_address = null;
        await this.menuRepository.save(parentDirectory);
      }
    }

    const menu = this.menuRepository.create({
      menu_name: createMenuDto.menu_name,
      menu_icon: createMenuDto.menu_icon,
      component_name: createMenuDto.component_name,
      component_address: createMenuDto.component_address,
      menu_type: createMenuDto.menu_type,
      is_cached: createMenuDto.is_cached,
      parent_id: createMenuDto.parent_id ?? 0,
      is_show: createMenuDto.is_show,
      menu_remark: createMenuDto.menu_remark,
    });

    await this.menuRepository.save(menu);

    return {
      data: menu,
      message: '菜单添加成功',
    };
  }

  /**
   * @param menuId 需要删除的id
   * @returns 是否删除
   */
  async deleteMenu(menuId: any) {
    const menu = await this.menuRepository.findOne({
      where: { menu_id: menuId }
    });

    if (!menu) {
      throw new Error('菜单不存在,请刷新后重试');
    }

    if (menu.menu_type === 0) {
      const menuList = await this.menuRepository.find({
        where: { parent_id: menuId }
      });
      await this.menuRepository.remove(menuList);
      await this.menuRepository.remove(menu);
    } else {
      await this.menuRepository.remove(menu);
    }

    return {
      message: '菜单删除成功'
    }
  }

  /**
   * @param menuData 菜单数据
   * @returns 修改菜单
   */
  async updateMenu(UpdateMenuDto: UpdateMenuDto) {
    const menu = await this.menuRepository.findOne({
      where: { menu_id: UpdateMenuDto.menu_id }
    });

    if (menu.menu_type === 0 && UpdateMenuDto.menu_type === 1) {
      throw new Error('目录无法修改为菜单');
    }

    await this.menuRepository.update(UpdateMenuDto.menu_id, UpdateMenuDto);

    return {
      message: '菜单修改成功',
      data: UpdateMenuDto
    }
  }

  /**
   * @param menuId 菜单id
   * @returns 获取菜单详情
   */
  async getMenuById(menuId: any) {
    const menu = await this.menuRepository.findOne({
      where: { menu_id: menuId }
    });

    if (!menu) {
      throw new Error('菜单不存在,请刷新后重试');
    }

    return menu;
  }

  // 获取菜单选项框数据（只返回当前用户有权限的菜单）
  async getMenuOptions(user_id: number) {
    // 1. 查询用户的角色
    const user = await this.userRepository.findOne({
      where: { user_id }
    });

    if (!user) {
      throw new NotFoundException('用户不存在，请重新登录后重试');
    }

    // 2. 通过角色查询有权限的 menu_id 列表
    const roleMenus = await this.roleMenuRepository.find({
      where: { role_id: user.role_id }
    });
    const allowedMenuIds = roleMenus.map(rm => rm.menu_id);

    // 3. 查出所有菜单，按 menu_sort 排序，再过滤成用户有权限的菜单
    const allMenus = await this.menuRepository.find({
      order: { menu_sort: 'ASC' }
    });

    const authorizedMenus = allMenus.filter(menu =>
      allowedMenuIds.includes(menu.menu_id)
    );

    // 4. 构建成树形结构（只用有权限的菜单）
    const menuTree = this.buildMenuTree(authorizedMenus);

    // 5. 递归过滤函数：只保留叶子节点（有 table_name）或有有效子节点的目录
    const filterTree = (nodes: any[]): any[] => {
      const result: any[] = [];

      for (const node of nodes) {
        const hasTable = !!node.table_name;
        const isDirectory = node.menu_type === 0;

        let validChildren: any[] = [];
        if (node.children && node.children.length > 0) {
          validChildren = filterTree(node.children);
        }

        if (hasTable) {
          node.children = validChildren;
          result.push(node);
        } else if (isDirectory) {
          if (validChildren.length > 0) {
            node.children = validChildren;
            result.push(node);
          }
        }
      }
      return result;
    };

    // 6. 执行过滤并返回
    return filterTree(menuTree);
  }

  /**
     * 获取菜单列模板列表（分页 + 按菜单名搜索）
     * 关联查询菜单名称
     */
  async getMenuStatusList(searchForm: SearchForm): Promise<PaginatedResult<any>> {
    // menu_status 表已有 menu_name，直接分页返回，无需关联 menu_list
    const result = await this.paginationService.paginate(
      this.menuStatusRepository,
      searchForm,
    );

    return {
      ...result,
      data: result.data.map(item => ({
        ...item,
        column_config: (item.column_config ?? []).sort(
          (a, b) => a.displayIndex - b.displayIndex,
        ),
      })),
    };
  }

  /**
     * 获取指定菜单的列表状态（列排序、是否显示该列）
     * @param menuId 菜单id
     * @returns menuStatus
     */
  async getMenuStatus(menuId: number) {
    const menuStatus = await this.menuStatusRepository.findOne({
      where: { menu_id: menuId },
    });

    if (!menuStatus || !menuStatus.column_config?.length) {
      return {
        menu_id: menuId,
        menu_name: menuStatus?.menu_name ?? null,  // ← 带上
        column_config: DEFAULT_ROLE_COLUMNS,
        is_default: true,
      };
    }

    const sortedColumns = [...menuStatus.column_config]
      .sort((a, b) => a.displayIndex - b.displayIndex)
      .filter(col => col.visible);

    return {
      menu_status_id: menuStatus.menu_status_id,
      menu_id: menuId,
      menu_name: menuStatus.menu_name,  // ← 带上
      column_config: sortedColumns,
      is_default: false,
    };
  }

  /**
   * 保存菜单列模板（新增）
   * @param menuId 菜单ID
   * @param columnConfig 列配置
   */
  async saveMenuStatus(menuId: number, columnConfig: ColumnConfig[]) {
    const existing = await this.menuStatusRepository.findOne({
      where: { menu_id: menuId },
    });

    if (existing) {
      return { message: '该菜单已有列模板配置，请使用更新接口', data: existing };
    }

    // 从 menu_list 查一次 menu_name，存进去，之后就不用再关联了
    const menu = await this.menuRepository.findOne({
      where: { menu_id: menuId },
    });
    if (!menu) {
      throw new NotFoundException('菜单不存在，请刷新后重试');
    }

    const newStatus = this.menuStatusRepository.create({
      menu_id: menuId,
      menu_name: menu.menu_name,
      column_config: columnConfig,
    });

    await this.menuStatusRepository.save(newStatus);
    return { message: '列模板创建成功', data: newStatus };
  }

  /**
   * 更新指定菜单的列模板
   * @param menuStatusId  menu_status 主键
   * @param dto           新的列配置
   */
  async updateMenuStatus(menuStatusId: number, dto: UpdateMenuStatusDto) {
    const menuStatus = await this.menuStatusRepository.findOne({
      where: { menu_status_id: menuStatusId },
    });

    if (!menuStatus) {
      throw new NotFoundException('列模板配置不存在，请刷新后重试');
    }

    const sortedConfig = [...dto.column_config].sort(
      (a, b) => a.displayIndex - b.displayIndex,
    );

    await this.menuStatusRepository.update(menuStatusId, {
      column_config: sortedConfig,
    });

    return {
      message: '列模板更新成功',
      data: {
        menu_status_id: menuStatusId,
        menu_name: menuStatus.menu_name,  // ← 补上
        column_config: sortedConfig,
      },
    };
  }

  /**
   * 删除指定菜单的列模板配置（前端将恢复默认列）
   * @param menuStatusId  menu_status 主键
   */
  async deleteMenuStatus(menuStatusId: number) {
    const menuStatus = await this.menuStatusRepository.findOne({
      where: { menu_status_id: menuStatusId },
    });

    if (!menuStatus) {
      throw new NotFoundException('列模板配置不存在，请刷新后重试');
    }

    await this.menuStatusRepository.remove(menuStatus);

    return { message: '列模板配置已删除，将恢复默认列配置' };
  }

  /**
   * 根据权限获取用户可操作的菜单
   * 这里补全了逻辑，先获取数据再构建树
   */
  /**
   * 根据用户角色获取有权限的菜单树
   */
  async getAuthMenuTreeByUser(user_id: number) {
    // 1. 查询用户的角色
    const user = await this.userRepository.findOne({
      where: { user_id }
    });

    // 2. 通过角色查询有权限的 menu_id 列表
    const roleMenus = await this.roleMenuRepository.find({
      where: { role_id: user.role_id }
    });
    const allowedMenuIds = roleMenus.map(rm => rm.menu_id);

    // 3. 查询完整菜单树，过滤没权限的节点
    const allMenus = await this.menuRepository.find({
      order: { menu_sort: 'ASC' }
    });

    const filteredMenus = allMenus.filter(menu =>
      allowedMenuIds.includes(menu.menu_id)
    );

    // 4. 组装成树结构返回
    return this.buildMenuTree(filteredMenus);
  }

  /**
   * 组装树结构
   */
  private buildMenuTree(menus: MenuEntity[], parentId = 0): any[] {
    return menus
      .filter(m => m.parent_id === parentId)
      .map(m => {
        const children = this.buildMenuTree(menus, m.menu_id);
        // 如果 children 数组不为空，则添加 children 属性；否则不添加该属性
        return {
          ...m,
          ...(children.length ? { children } : {})
        };
      });
  }

  /** ==================================
   * 
   * 操作模块
   * 
   * ==================================
   */

  /**
   * 添加操作
   */
  async addOperation(createOperationDto: CreateOperationDto) {
    // 校验菜单是否存在
    const menu = await this.menuRepository.findOne({
      where: { menu_id: createOperationDto.menu_id }
    });
    if (!menu) {
      throw new NotFoundException('菜单不存在，请刷新后重试');
    }

    const operation = this.operationRepository.create({
      operation_name: createOperationDto.operation_name,
      operation_sign: createOperationDto.operation_sign,
      operation_port: createOperationDto.operation_port,
      operation_method: createOperationDto.operation_method,
      menu_id: createOperationDto.menu_id,
    });

    await this.operationRepository.save(operation);

    return {
      data: operation,
      message: '操作添加成功',
    };
  }

  /**
   * 获取某菜单下的操作列表
   */
  async getOperationList(menuId: number) {
    const list = await this.operationRepository.find({
      where: { menu_id: menuId }
    });
    return {
      data: list,
      total: list.length,
    };
  }

  /**
   * 删除操作
   */
  async deleteOperation(operationId: number) {
    const operation = await this.operationRepository.findOne({
      where: { operation_id: operationId }
    });
    if (!operation) {
      throw new NotFoundException('操作不存在，请刷新后重试');
    }
    await this.operationRepository.remove(operation);
    return { message: '操作删除成功' };
  }
}
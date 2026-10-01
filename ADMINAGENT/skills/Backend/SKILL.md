---
enabled: true
---

# 后端开发规范 · ADMINSERVER

> 本文件是 ADMINSERVER 唯一的后端规范，由现有代码里的实际约定提炼而成。
> 新增模块、接口、DTO、实体一律照此执行；与本文冲突的写法都视为不合规。

## 一、技术栈与版本

NestJS 10 + TypeORM 0.3.27 + MySQL（`mysql2`）+ TypeScript 5.1（`commonjs`、`target: ES2021`、装饰器全开）。
配套：`@nestjs/jwt` 11 + `passport-jwt` + `bcrypt`（鉴权与口令散列）、`class-validator` + `class-transformer`（校验）、
`xlsx`（Excel 导入）、`uuid`、`dayjs`、`multer`（上传）；包管理器固定为 **pnpm 10**。
脚本：`npm run start:dev`（热重载）、`npm run build`（`nest build`）、`npm run start:prod`（`node dist/main`）、`npm run lint`、`npm run format`。

## 二、目录结构与落位规则

| 位置 | 约定 |
| --- | --- |
| `src/main.ts` | 启动引导：全局前缀、拦截器、过滤器、CORS、端口 |
| `src/app.module.ts` | 根模块：读 env、注册 TypeORM 数据源与各业务 Module |
| `src/module/system/<资源>.module.ts` | 模块定义，`TypeOrmModule.forFeature([...], 'etp_default_sql')` |
| `src/controller/system/<资源>.controller.ts` | 控制器，`@Controller('<资源名>')`，只做参数与转发 |
| `src/services/system/<资源>.service.ts` | 业务逻辑，唯一可以直接碰 Repository 的地方 |
| `src/dto/system/<资源>/<动作>.dto.ts` | 入参 DTO，class-validator 装饰器 + 中文 `message` |
| `src/entities/system/<资源>.entity.ts` | TypeORM 实体，外部表放 `entities/system/other/` |
| `src/common/**` | 跨模块能力：拦截器、守卫、过滤器、装饰器、分页、工具 |
| `src/enums/**` | 枚举常量（如导入用的 `ENUM_REGISTRY`） |

命名一一对应：`user.controller.ts` → `UserController`、`user.service.ts` → `UserService`、`user.entity.ts` → `UserEntity`、
`user.module.ts` → `UserModule`，且都要注册进 `app.module.ts` 的 `imports`。导入统一使用 `baseUrl: "./"` 的绝对路径
`src/...`（如 `import { UserService } from "src/services/system/user.service";`），不要写一长串 `../../`。

## 三、模块注册与全局能力

以下是 `main.ts` 一次性挂载的全局能力，**新接口不必重复声明**：

- 全局前缀 `app.setGlobalPrefix('hippoadmin')`：所有接口路径前自动加上 `/hippoadmin`；
- `TransformInterceptor` 统一成功返回、`HttpExceptionFilter` 统一错误返回（HTTP 状态码恒为 200）；
- `corsConfig`（`src/common/cors.ts`）跨域：`origin: true`、`credentials: true`；
- `Logger.overrideLogger(new FileLogger())` 文件日志：控制台 + `logs/app-YYYY-MM-DD.log`；
- 端口 `Number(process.env.PORT) || 5004`，默认为 **5004**（PM2 里用 `PORT` 覆盖）。

`CommonModule` 是 `@Global()` 模块：`ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env.development' })`
（普通模块直接注入 `ConfigService` 即可）、全局鉴权守卫 `{ provide: APP_GUARD, useClass: AuthGuard }`
（来自 `src/common/verify-token.ts`），并导出 `PaginationService`、`ToolService`、`TreePaginatedQuery`、
`MenuService`、`ExcelService`、`FilesService`、`CommonService` 与 `TypeOrmModule`。

数据源名固定为 **`etp_default_sql`**（库名也是它）。凡 `@InjectRepository`、`@InjectDataSource`、`forFeature`
都必须带上，否则拿不到连接：

```ts
TypeOrmModule.forFeature([UserEntity, RoleMenuEntity], 'etp_default_sql'),
```

`app.module.ts` 的数据源开了 `autoLoadEntities: true`、`synchronize: true`（实体即表结构）、`logging: true`、
连接池 `connectionLimit: 10`、超时 60s。

## 四、接口与返回体约定

**成功**（由 `TransformInterceptor` 自动包装，Service 不要自己拼 `code`）：

```jsonc
{ "code": 2000, "message": "操作成功", "data": { } }
```

三条规则：① Service 返回对象里带 `message` 时，它变成外层 `message` 并从 `data` 剔除，不写就是 `操作成功`；
② 返回值同时含 `total` 与 `data` 时，整体作为 `data` 传出（`data: { data: [...], total: 100, pageNumber, pageSize }`）；
③ 返回**数组**且方法带 `@ShowDataNum()` 时，被包成 `{ total: 数组长度, data: 数组 }`。

**失败**（由 `HttpExceptionFilter` 捕获，HTTP 状态码恒为 200）：`{ "code": 4000, "msg": "账号已存在", "data": null }`。
⚠️ 成功体字段是 `message`，异常过滤器输出的却是 `msg`（历史写法，两者都在线上跑）；前端判断只用 `code` 与 `data`。

| code | 含义 | 出现位置 |
| --- | --- | --- |
| `2000` | 成功 | 拦截器统一产出 |
| `4000` | 业务错误（默认） | `BusinessException` 不传 code、其它 `HttpException` |
| `4001` | 登录过期 | `verify-token.ts` 校验失败 |
| `4002` | 文件相关校验失败 | `file.service.ts` / `file.controller.ts` |
| `4003` | 暂无该操作权限 | `common/guards/auth.guard.ts` |
| `4006` | 文件不存在 / 已丢失 | `file.service.ts` |

## 五、Controller 写法

只做「收参数 → 调 Service → 返回」，不写业务分支：

```ts
import { AuthGuard } from "@nestjs/passport";                                            // JWT 验证
import { AuthGuard as PermissionGuard, Permission } from "src/common/guards/auth.guard"; // 操作权限验证

@Controller('menu')
export class MenuController {
    constructor(private readonly menuService: MenuService) {}

    /** 获取菜单列表 */
    @Get('/list')
    @UseGuards(AuthGuard('jwt'))
    getMenuList(@Query() searchForm: any) {
        return this.menuService.getMenuList(searchForm);
    }

    /** 添加菜单 */
    @Post('/addMenu')
    @UseGuards(AuthGuard('jwt'), PermissionGuard)
    @Permission('MenuManagement.add')
    @UsePipes(new ValidationPipe())
    addMenu(@Body() createMenuDto: CreateMenuDto) {
        return this.menuService.addMenu(createMenuDto);
    }
}
```

- `@Controller('xxx')` 里**不写** `/hippoadmin`，前缀由 `setGlobalPrefix` 统一添加。
- **读用 `@Get`、写用 `@Post`**（本仓库里删除也是 `@Post(':id/delete')` 或 `@Get('/delete')`，属历史原因，新接口沿用 POST）。
- 需登录的接口显式写 `@UseGuards(AuthGuard('jwt'))`；需操作权限的再加 `PermissionGuard` + `@Permission`。
- **`ValidationPipe` 不是全局注册的**：用了 DTO 校验的接口必须自己写 `@UsePipes(new ValidationPipe())`，否则校验不生效。
- 路径参数用 `@Param('userId', ParseIntPipe)`；查询用 `@Query()` / `@Query('menuId')`；免登录接口挂 `@Public()`。
- ⚠️ 两个同名 `AuthGuard` 别混：`@nestjs/passport` 的用于 `AuthGuard('jwt')`，`src/common/guards/auth.guard.ts` 的必须 `as PermissionGuard` 引入。

## 六、Service 写法

```ts
@Injectable()
export class UserService {
    constructor(
        @InjectRepository(UserEntity, 'etp_default_sql')
        private readonly userRepository: Repository<UserEntity>,
        private readonly paginationService: PaginationService,
    ) {}

    /**
     * 获取用户列表
     * @param searchForm 查询参数
     * @returns 用户列表
     */
    async getUserList(searchForm: SearchForm): Promise<PaginatedResult<UserEntity>> {
        return this.paginationService.paginate(this.userRepository, searchForm);
    }

    /** 新增用户 */
    async addUser(createUserDto: CreateUserDto) {
        const user = await this.userRepository.findOne({ where: { account: createUserDto.account } });
        if (user) throw new BusinessException('账号已存在');

        createUserDto.password = await bcrypt.hash(createUserDto.password, 10);
        return await this.userRepository.save(createUserDto);
    }
}
```

- 方法一律 `async`，返回 `PaginatedResult<T>` 或「带 `message` 的对象」，**不返回** `{ code, message, data }`。
- 提示语用 `return { message: '用户删除成功' }`，拦截器会提到外层；密码类字段返回前 `delete user.password`，绝不回显散列值。
- 多步操作保持「先查 → 校验 → 再写」，校验失败立刻 `throw new BusinessException('人话提示')`。

## 七、DTO 与 class-validator 校验

DTO 放 `src/dto/system/<资源>/`，同目录内文件命名风格保持统一（现有 `create_user.dto.ts` 与 `add-user.dto.ts` 两种写法）：

```ts
import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from "class-validator";

export const REGEX = { ACCOUNT: /^[a-zA-Z0-9_]{3,20}$/, PHONE: /^(\+86)?1[3-9]\d{9}$/ };

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: "账号不能为空" })
  @Matches(REGEX.ACCOUNT, { message: "账号只能由字母、数字、下划线组成，且长度3-20位" })
  account: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: "性别只能是0（未知）、1（男）、2（女）" })
  gender: number;
}
```

- `message` **必须写中文**，它会成为「系统日志」里那条审计记录的提示语。
- 可选字段用 `@IsOptional()`；查询参数需要数字时用 `@Type(() => Number)` 转换。
- 分页入参复用 `src/dto/system/common/pagination.dto.ts` 的 `PagingDto` / `BaseSearchDto`
  （`pageNumber`、`pageSize`、`sortField`、`sortDirection`，默认 1 / 10）；正则常量抽到文件顶部（如 `REGEX.ACCOUNT`）。

## 八、TypeORM 实体

```ts
@Entity({ database: 'etp_default_sql', name: "user_list" })
export class UserEntity {
  @PrimaryGeneratedColumn({ comment: '用户id', type: 'int' })
  user_id: number;

  @Column({ comment: '账户', type: 'varchar', length: 30, unique: true })
  account: string;

  @Column({
    comment: '更新时间', type: 'datetime', nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP', // 数据库更新时自动修改
  })
  updated_at: Date;
}
```

- 表名蛇形（`user_list`、`menu_list`、`file_list`、`operation_log`），实体类大驼峰 + `Entity` 后缀。
- 主键统一 `<业务>_id`，用 `@PrimaryGeneratedColumn`；`@Column` 的 `comment` **必须写中文**。
- 布尔列用 `type: 'boolean'`（`is_cached` / `is_show`）；时间戳统一 `created_at` / `updated_at` + `CURRENT_TIMESTAMP`。
- 逻辑删除列叫 `is_deleted`（存在时会被分页服务自动过滤）；`file_list` 没有这列，别硬套。
- 枚举字段用 TS 枚举（`FileType`、`BusinessType`），新增业务类型只在枚举里加一行。

## 九、查询：Repository 与 QueryBuilder

优先 Repository 方法：`find` / `findOne` / `findBy` / `findAndCount` / `save` / `create` / `update` / `remove` / `delete` / `clear`，
条件用操作符（`In`、`IsNull`、`Like`），例如 `findBy({ menu_id: In(filteredIds) })`。
复杂条件用 `createQueryBuilder`，**参数必须走占位符**，不拼字符串：

```ts
const qb = repository.createQueryBuilder('entity');
qb.andWhere(`entity.${key} LIKE :${key}`, { [key]: `%${value}%` });
qb.orderBy(`entity.created_at`, 'DESC');
const total = await qb.getCount();
const data = await qb.skip((pageNumber - 1) * pageSize).take(pageSize).getMany();
```

批量场景先批量查再用 `Map` 组装，禁止循环里查库（N+1）：`FilesService.getLatestFileBase64Map` / `attachLatestFile`
就是「给一批 `business_id` 贴最新文件」的现成封装。

## 十、分页与树形分页

**入参**：`src/common/types/pagination.types.ts` 的 `SearchForm`，与前端 `searchForm` 完全对应；
**出参**：`PaginatedResult<T>`，即 `{ data: T[], total, pageNumber, pageSize }`，被拦截器包在 `res.data` 里（前端读 `res.data.data`）。

```ts
{
  ep: { account: 'zhang' },                       // 简单条件：字符串走 LIKE %v%，其它走等值，空值忽略
  paging: { pageNumber: 1, pageSize: 10, sortField: 'created_at', sortDirection: 'DESC' },
  cdList: [{ fieldName: 'status', fieldValue: '1', operation: 'EQ', andNext: '1', type: 'NUMBER' }],
}
```

`PaginationService.paginate(repository, searchForm, extraWhere?)` 的行为约定：

- 默认排序 `created_at DESC`；`ep` 里字符串一律 `LIKE`，`undefined` / `null` / `''` 直接忽略。
- 实体存在 `is_deleted` 列时**自动只查未删除数据**，调用方显式传 `ep.is_deleted` 即可覆盖（回收站场景）。
- `cdList` 是高级筛选：`operation` 支持 `INCLUDE / NOTINCLUDE / STARTWITH / ENDWITH / EQ / NE / GT / GE / LT / LE / BW`；
  `andNext` 为 `'1'` 用 AND、`'0'` 用 OR（第一条忽略）；`type: 'NUMBER'` 会 `CAST(... AS DECIMAL(20,6))` 再比较。

**树形分页**用 `TreePaginatedQuery.queryWithTransform`：先拉全量扁平数据，按 `ep` 从子级向上回溯祖先链，
建树后**只对根节点分页**（子节点全量挂在 `children` 上）。菜单就是这么查的：

```ts
return this.treePaginatedQuery.queryWithTransform<MenuData>(
  () => this.menuRepository.find({ order: { menu_sort: 'ASC' } }),                  // 拉全量
  searchForm,
  async (filteredList) => filteredList.map(m => ({ ...m, operationChildren: [] })),  // 建树前加工
  "parent_id", 0, "menu_id",   // parentIdField / rootValue / primaryKey
);
```

树形数据同样支持 `is_deleted`：父节点被删除时，其子孙节点也一并剔除，避免出现断链。

## 十一、操作审计（写操作自动记录）

`OperationLogInterceptor` 以 `APP_INTERCEPTOR` 注册在 `SystemOpsModule`，**全局生效、业务代码零侵入**：

- `POST / PUT / PATCH / DELETE` 一律记录；`GET` 只在命中「实际是写」的接口（`destructive: true`，如 `GET menu/delete`）时记录；
  跳过 `/audit/`、`/log/read`、`/log/files`、`/ping`、`/verifyToken`、`/refresh_token`。
- 落库 `operation_log`：操作人（`user_id` / `username` / `role_id`）、`method`、`url`、中文操作名 `action_name`、
  操作标识 `action_sign`、`menu_id`、参数摘要 `summary`（已脱敏）、`result_message`、`success`、`duration`、`ip`、`user_agent`。
- 中文操作名优先查 `operation_list`（按 `operation_method` + `operation_port` 匹配，端口为空的行跳过，60 秒内存缓存），
  查不到再用代码内置的 `OPERATION_ROUTES` 路由表兜底，都查不到才显示 `method + url`。
- 摘要规则：优先展示 `id/name/account/username/role/menu/...` 类字段；`password/secret/token/authorization`
  等只留字段名、值写成 `***`；数组记成 `key=[N项]`；字符串超 40 字符不记；最多 6 个字段、总长 120 字符。
- 审计写库全程 `try/catch`，失败只打 `warn`，**绝不影响正常业务**。

**新增写接口必须登记中文操作名**（否则「系统日志」里只看得到 `POST /hippoadmin/xxx`）：
首选在「菜单管理 → 操作」新增 `operation_list` 记录，或在代码里补 `OPERATION_ROUTES`（顺序敏感，更具体的路径写前面；
`operation_port` 支持 `:id` 占位）。

## 十二、鉴权与 @Permission

1. **登录态**：全局守卫 `AuthGuard`（`src/common/verify-token.ts`）校验 `Authorization: Bearer <token>`，
   未登录抛 `BusinessException('请先登录')`，过期抛 `BusinessException('登录过期', 4001)`；`@Public()` 直接放行。
2. **操作权限**：`@UseGuards(AuthGuard('jwt'), PermissionGuard)` + `@Permission('UserAdminPage.add')`，
   守卫用 `request.user.role_id` 去 `role_operation` 表匹配 `operation_code`，匹配不到抛 `BusinessException('暂无该操作权限', 4003)`。

```ts
@Post('add')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Permission('UserAdminPage.add')
async addUser(@Body() createUserDto: CreateUserDto) { /* ... */ }
```

- `@Permission` 的别名与 `role_operation.operation_code` / `operation_list.operation_sign` 是**同一个字符串**
  （形如 `UserAdminPage.add`、`DataImport.importExcel`），写错就是永久 4003。
- JWT payload 为 `{ sub: 用户ID, username, role_id }`，`role_id` **必须是数字**（写成角色名字符串会让所有带权限的接口都报 4003）。
- 只做登录校验、暂不做角色控制的接口（如 `system-ops/*`），在注释里写明原因。

## 十三、日志

- 全局 `FileLogger`（`main.ts` 里 `Logger.overrideLogger`）：控制台保留输出（前缀 `[HC]`），同时按天追加写入
  `logs/app-YYYY-MM-DD.log`，目录可用 `LOG_DIR` 覆盖，单文件 10MB 上限。
- 业务代码里 `private readonly logger = new Logger(XxxService.name);` 后正常调用 `log / warn / error / debug / verbose`。
- ⚠️ `FileLogger` 内部用 `console` 输出，**不要**在它里面再用 Nest 的 `Logger`，否则无限递归。
- 两个「日志」别搞混：`logs/app-YYYY-MM-DD.log` 是技术排障的原始日志，「系统日志」页面的**文件查看**读它
  （`system-ops/log/files`、`/log/read`，文件名须匹配 `^[A-Za-z0-9_-]+\.log$`，默认 200 行、最多 2000 行）；
  `operation_log` 表则是给非技术人员看的操作审计（「系统日志」主数据，`/audit/list`）。

## 十四、文件上传与 Excel 导入导出

**文件上传**走 `@Controller('files')` + `FileInterceptor`，先把文件读进内存，再统一转成 base64 落盘：

```ts
@Post('upload')
@UseInterceptors(
    FileInterceptor('file', {
        storage: memoryStorage(),                    // 先读进内存，再决定怎么存
        limits: { fileSize: 10 * 1024 * 1024 },      // 10MB
    }),
)
```

- 参数固定为 `business_type` / `business_id` / `file_type`，非法值抛 `BusinessException(..., 4002)`。
- 磁盘路径 `uploads/<business_type>/`（`getUploadDir()` 自动建目录，Windows/Linux 通用），存储名 `uuid.b64`
  （内容就是纯 base64 文本），对外只用 `code`（uuid）引用，不暴露自增 ID；类型白名单在 `MIME_RULES` 里，新增类型同步补规则。

**Excel 导入**走 `@Controller('excel')`，用 `xlsx` 解析：

| 接口 | 装饰器 | 说明 |
| --- | --- | --- |
| `POST excel/import/:menu_id` | `FileInterceptor('file')` | 单文件导入，表名从 `@Body('tableName')` 拿 |
| `POST excel/batch-import` | `FilesInterceptor('files')` | 多文件批量导入，空文件抛 `BadRequestException('请上传文件')` |
| `GET excel/importHistory/list` | — | 导入历史（`import_history` 表，按 `import_time DESC`） |
| `GET excel/clearHistory` | `@Permission('DataImport.clearImportHistory')` | 清空导入历史 |

流程：解析首个 sheet → 按 `menu_id` 取列模板（`menu_status.column_config`，把中文表头映射成数据库字段并处理枚举）
→ 校验必填列与唯一索引 → 按 `BATCH_SIZE = 500` 分批 upsert，返回「成功 / 失败 / 跳过 / 错误行」统计。
新增可导入的表，需要先在「菜单配置」里配好列模板。

## 十五、环境变量与配置

`.env.example` 声明的键（**真实值只写在本机 `.env*` 里，绝不提交**）：

| 键 | 说明 |
| --- | --- |
| `JWT_SECRET` | JWT 签名密钥，务必改成强随机值；代码兜底值是 `'hippoadmin'` |
| `DB_HOST` | MySQL 地址（未配置时默认 `127.0.0.1`） |
| `DB_PORT` | 端口，默认 `3306` |
| `DB_USERNAME` | 账号，未配置时默认 `ETP_DEFAULT_SQL` |
| `DB_PASSWORD` | 口令，未配置时默认 `kevin_hippo` |
| `DB_DATABASE` | 库名，默认 `etp_default_sql` |

运行期还读 `PORT`（PM2 配置，默认 5004）、`LOG_DIR`（日志目录）、`NODE_ENV`（决定生效的 env 文件名）。
`CommonModule` 指定 `envFilePath: '.env.development'`（开发），生产用默认 `.env`；「系统运维 - 环境配置」
保存前会备份到 `backup/env/<文件名>.<时间戳>.bak`。JWT 有效期在两处出现过（`app.module.ts` 的 `1h`、
`CommonModule` 的 `12h`），修改时需同时检查这两处。

## 十六、错误处理与 BusinessException

业务错误统一抛 `BusinessException`，它强制 HTTP 200、只带业务码：

```ts
import { BusinessException } from 'src/common/exceptions/business.exception';

throw new BusinessException('账号已存在');          // code 4000
throw new BusinessException('登录过期', 4001);      // 指定 code
```

- Nest 内置异常（`NotFoundException` / `BadRequestException`）也会被过滤器捕获，按 `code = res.code || 4000`、
  `message = res.message` 输出，也可以用，但提示语要写人话。
- ⚠️ **不要 `throw new Error(...)`**：`@Catch(HttpException)` 捕不到它，统一返回体会失效
  （现有 `menu.controller.ts` 里还残留这种写法，新代码不要照抄）。
- 提示语写成用户能看懂的中文（如「菜单不存在，请刷新后重试」），不要暴露 SQL / 堆栈；查询类接口查不到数据时返回空数组 / `null`，不抛异常。

## 十七、与前端 ADMINCLIENT 的对接

前端接口层在 `ADMINCLIENT/src/pages/<业务组>/<页面>/api.ts`，一页一文件，统一走 `requestApi`：

```ts
import requestApi from "@/utils/request/request";

/** 获取用户列表 */
export function getUserList(data: any) {
  return requestApi({ url: '/hippoadmin/user/list', method: 'get', params: data });
}
```

- URL 写**全路径**，即 `/hippoadmin` + 后端 `@Controller` 路径 + 方法路径，三段必须对得上。
- 统一返回 `{ code, message, data }`；页面里判断 `if (res.code === 2000) { ... }`。
- 列表接口返回 `{ total, data }`，被包在 `res.data` 里，所以前端读 `res.data.data`。
- 分页 / 搜索参数统一 `{ ep, paging, cdList }`，与后端 `SearchForm` 一一对应。
- 表格列来自「菜单配置」（`menu_status.column_config`），后端 `menu/status/*` 接口负责读写，删掉列模板即恢复默认列。

## 十八、注释与命名

- 注释用中文；文件顶部写来源路径（如 `// src/common/dto/pagination.dto.ts`）。
- 分节注释沿用 `/** Xxx Setting / 中文 */` 风格；长流程用步骤注释（`// ─── Step 1: 解析 Excel ───`、
  `// ==================== 关于系统 ====================`）。
- 方法上方写 JSDoc：一句中文说明，需要时补 `@param` / `@returns`。
- 数据库字段用蛇形（`user_id`、`component_address`），TS 变量 / 方法用驼峰；布尔用 `is/has` 前缀（`is_cached`、`hasFilter`）。
- 常量抽到文件顶部并写中文注释（如 `MAX_FILE_SIZE`、`BATCH_SIZE`、`SUMMARY_MAX_FIELDS`），不要散落魔法数字。
- 一个文件只放一个主类；导入顺序：Nest 内置 → 第三方 → `src/` 内部。

## 十九、提交前自检清单

- [ ] 新模块已注册进 `app.module.ts`，`forFeature` / `@InjectRepository` 都带 `'etp_default_sql'`
- [ ] Controller 只做转发，业务在 Service，用了 DTO 的接口都写了 `@UsePipes(new ValidationPipe())`
- [ ] 需登录的接口有 `@UseGuards(AuthGuard('jwt'))`，需权限的再加 `PermissionGuard` + `@Permission('Xxx.yyy')`
- [ ] 新增写接口已在「菜单管理 → 操作」或 `OPERATION_ROUTES` 登记中文操作名
- [ ] Service 不返回 `{ code, ... }`，提示语用 `message`，密码等敏感字段不回显
- [ ] 业务错误用 `BusinessException`（带中文提示），没有 `throw new Error(...)`
- [ ] 实体 `@Column` 都有中文 `comment`，时间戳列齐全，枚举新增项已补全
- [ ] 列表 / 树列表走 `PaginationService` / `TreePaginatedQuery`，没有循环查库
- [ ] 新增环境变量已同步补到 `.env.example`，`.env*` 里的真实口令**没有**被提交
- [ ] **import 路径大小写与磁盘一致**（Linux/CI 区分大小写）
- [ ] `cd ADMINSERVER && npm run build` 通过，`npm run lint` 无新增错误
- [ ] 提交信息形如 `feat(server): 中文说明`（提交走 Workspace 技能）

## 二十、与 Workspace 技能的关系

`Workspace`（`../Workspace/SKILL.md`）是**优先级最高**的技能：它规定「只能改本工作区内的文件」与
「每次改动都要有 git 记录、任何时刻能拉回」。本文件只管**后端代码怎么写**，边界、提交、回退一律以
`Workspace` 为准，不要在这里重复它的规则。

```bash
cd ADMINSERVER && npm run build     # 自检
node ADMINAGENT/skills/Workspace/scripts/commit-workspace.mjs "feat(server): 新增某某接口" --files "ADMINSERVER/src/xxx.ts"
```

`ADMINAGENT/README.md` 约定的技能目录结构同样适用：本技能的细则放 `rules/`、步骤放 `workflow/`，入口固定为本文件。

# 后端开发规范 · ADMINSERVER

> 本文件是 ADMINSERVER（NestJS）的唯一后端规范，由现有代码约定提炼而成。
> 新增接口、模块、实体一律照此执行；与本文冲突的写法都视为不合规。

## 一、技术栈

NestJS 10（Express）+ TypeORM 0.3 + MySQL + class-validator / class-transformer + JWT（passport-jwt）。
包管理器固定 **pnpm 10**，锁文件 `ADMINSERVER/pnpm-lock.yaml`（`packageManager` 字段已声明）。

## 二、目录结构

| 位置 | 约定 |
| --- | --- |
| `src/main.ts` | 全局前缀 `/hippoadmin`、全局拦截器/过滤器、日志、端口 |
| `src/app.module.ts` | 只做模块装配（ConfigModule → TypeOrmModule → 业务模块） |
| `src/module/system/<x>.module.ts` | 模块声明 |
| `src/controller/system/<x>.controller.ts` | 控制器，只做参数接收与转发 |
| `src/services/system/<x>.service.ts` | 业务逻辑 |
| `src/dto/system/<x>/<x>.dto.ts` | 入参校验 DTO |
| `src/entities/system/<x>.entity.ts` | TypeORM 实体；杂项放 `entities/system/other/` |
| `src/common/**` | 守卫、拦截器、过滤器、装饰器、工具、日志 |
| `cicd/` | 该工程的 CI/CD 脚本（见 `cicd/README.md`） |

## 三、统一响应与异常

- 全局 `TransformInterceptor` 把所有返回值包装成 `{ code: 2000, message, data }`；
  若业务对象里有 `message` 字段会被提到外层并从 `data` 中移除——**不要依赖 data 里的 message 回传数据**。
- 返回 `{ total, data }` 会被识别为分页结构，原样放进 `data`。
- 业务错误统一抛 `BusinessException(message, code)`：HTTP 状态固定 200，业务码 4000（通用）、4001（登录过期）、4003（无操作权限）。

```ts
if (!menu) throw new BusinessException('菜单不存在，请刷新后重试');
```

## 四、鉴权与权限

- 全局守卫 `src/common/verify-token.ts` 的 `AuthGuard` 已通过 `APP_GUARD` 注册，
  默认所有接口都要登录；放行用 `@Public()`。
- 控制器方法上再显式写 `@UseGuards(AuthGuard('jwt'))`（来自 `@nestjs/passport`），与现有代码保持一致。
- 操作级权限用 `@UseGuards(AuthGuard('jwt'), PermissionGuard)` + `@Permission('XxxPage.action')`，
  其中 `XxxPage.action` 必须与 `operation_list.operation_sign` 一致，
  并且要在「菜单管理 → 操作」里建好记录、在「角色管理」里授权，否则所有账号都会得到 **4003**。
  新模块若暂时不想让所有人被拦，就先只做登录校验，并在注释里写明后续补权限的方式。
- ⚠️ **token 里的 `role_id` 必须是 `user_list.role_id`（数字）**。历史上登录接口误用了
  `user.role_name`（角色名字符串），导致 `role_operation.role_id` 永远匹配不到、所有带权限的接口都返回 4003。
  改动登录/刷新 token 逻辑时务必保持两者一致。

## 五、控制器规范

```ts
/**
 * 系统运维 - 关于系统
 */
@Get('/about')
@UseGuards(AuthGuard('jwt'))
getAbout() {
    return this.systemOpsService.getAbout();
}
```

- 装饰器顺序：`@Public()`（如有）→ 路由 → 守卫 → 管道。
- 带 body/query 的入参用 DTO + `@UsePipes(new ValidationPipe())`。
- 控制器里不写业务逻辑，只做转发；方法上方写中文 JSDoc。
- `@Query()` 里的数字参数用 `@Param(name, ParseIntPipe)` 或接收字符串后在 service 里转换，
  不要依赖 DTO 的隐式类型转换（全局管道没开 `transform`）。

## 六、服务与数据访问

- 服务类用 `@Injectable()`，构造函数注入依赖；数据库连接名固定 `'etp_default_sql'`。
- 实体仓库：`@InjectRepository(XxxEntity, 'etp_default_sql')`；
  需要执行原生 SQL 时用 `@InjectDataSource('etp_default_sql')` + `this.dataSource.query(...)`。
- 实体统一写在 `@Entity({ database: 'etp_default_sql', name: '表名' })`，
  每个字段写 `comment`，时间列用 `@CreateDateColumn` / `@UpdateDateColumn`。
- `synchronize: true`，新增实体后重启即可自动建表，**不要手写迁移**。

## 七、DTO 规范

```ts
export class SaveXxxDto {
    @IsString()
    @IsNotEmpty({ message: '配置项名称不能为空' })
    key: string;

    @IsOptional()
    @IsBoolean()
    restart?: boolean;
}
```

- 校验装饰器 + **中文 message**，与前端提示语风格一致。
- 数字/布尔查询参数按字符串接收，在 service 内 `Number()` 转换并收敛范围。

## 八、分页与查询约定

- 列表接口统一接收 `{ ep, paging, cdList }`：
  - `ep`：等值/模糊查询条件
  - `paging`：`{ pageNumber, pageSize, sortField?, sortDirection? }`
  - `cdList`：前端列筛选
- 返回 `{ total, data }`，交给全局拦截器包装。
- 分页逻辑复用 `PaginationService`；树形分页复用 `TreePaginatedQuery`。

## 九、日志与操作审计

- 运行日志走全局 `FileLogger`（`common/logger/file.logger.ts`）：控制台 + 按天写入 `logs/app-YYYY-MM-DD.log`，
  「系统运维 → 系统日志」页面读的就是这里。
- 写操作（POST/PUT/PATCH/DELETE）由全局 `OperationLogInterceptor` 落库到 `operation_log`，
  记录：操作人、角色、接口、操作名（用 `operation_list` 反查中文名）、参数摘要（脱敏+截断）、
  业务返回消息、成功与否、耗时、IP、UA。新增写接口不需要额外代码，自动被记录。
- **严禁把密码、密钥、token 原文写进日志或审计记录**；摘要里要对 `password/token/secret/key` 等字段脱敏。

## 十、依赖与工程化（踩过的坑）

- pnpm 是**隔离式** `node_modules`，只有 `package.json` 里声明的依赖才能被 `require`。
  代码里直接 `import` 的包（如 `multer`）即使只是别人包的传递依赖，也**必须写进 `dependencies`**，
  否则本地 npm 布局能跑、pnpm 布局一启动就 `Cannot find module`。
- 版本对齐既有依赖：例如 `multer` 要与 `@nestjs/platform-express` 用的版本一致。
- 锁文件只保留 `pnpm-lock.yaml`，不要同时维护 `package-lock.json` / `yarn.lock`。
- **import 路径大小写必须与磁盘一致**：`forceConsistentCasingInFileNames: false` 会让 Windows 通过、
  Linux/CI 直接解析失败。

## 十一、CI/CD

- 所有流水线逻辑放在 `ADMINSERVER/cicd/`（`install.sh` / `build.sh` / `test.sh` / `deploy.sh` /
  `restart.sh` / `health-check.sh` / `common.sh`），GitHub Actions 只负责调用，保证本地与 CI 行为一致。
- 健康检查打的是 `/hippoadmin/system-ops/ping`；PM2 应用名默认 `main`。
- 新增依赖后必须提交更新后的 `pnpm-lock.yaml`，否则 CI 的 `--frozen-lockfile` 会失败。

## 十二、提交前自检清单

- [ ] 新增文件落在上表约定的目录，命名与既有文件一致
- [ ] 控制器只有转发逻辑，业务在 service，入参有 DTO 校验
- [ ] 抛错用 `BusinessException`，返回结构符合 `{ code, message, data }`
- [ ] 需要权限的接口已在 `operation_list` 建记录并在角色里授权
- [ ] 直接 import 的第三方包已写进 `dependencies`，并提交新的 `pnpm-lock.yaml`
- [ ] import 路径大小写与磁盘一致
- [ ] `pnpm run build` 通过（CI 也会跑）
- [ ] 涉及写操作时确认审计日志能记录到（脱敏正常）
- [ ] 提交信息形如 `feat(server): 中文说明`

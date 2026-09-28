# 汇创 ADMIN · 服务端（ADMINSERVER）

## 系统介绍

汇创 ADMIN（汇创管理端底座）的 NestJS 服务端。为前端提供基于 RBAC 的权限体系与通用能力：登录认证（JWT）、用户/角色/菜单/操作管理、菜单列模板、Excel 数据导入、文件上传、恢复默认等。

服务端面向**本机独立部署**：数据库默认指向 `127.0.0.1`，通过 `.env` 配置，不依赖任何远程服务器或第三方授权服务。

## 当前系统功能

- 登录认证：账号密码 + bcrypt 校验并签发 JWT
- Token 刷新：`refresh_token` 自动续签会话
- 用户管理：用户列表（分页/过滤/排序）、新增、修改、删除、修改密码、个人信息
- 角色管理：角色列表、新增、修改、删除、详情
- 权限配置：按角色配置菜单与操作（按钮级）权限
- 菜单管理：菜单树（目录/菜单）、菜单排序、新增/修改/删除
- 操作管理：按菜单维护操作（接口标识/地址/请求方式）
- 菜单列模板：按菜单配置列表列模板（列标题/字段/宽度/排序/显示）
- Excel 导入：单表导入、批量导入、导入历史、清空历史
- 文件服务：图片/文件上传、列表、内容（base64）与删除
- 恢复默认：以 `src/sql/default.sql` 重建数据库种子
- 通用能力：全局前缀 `/hippoadmin`、统一响应结构、异常处理、CORS

## 技术架构

```text
Backend
├── NestJS 10
├── TypeScript
├── TypeORM
├── MySQL（默认 127.0.0.1:3306）
├── @nestjs/jwt + passport-jwt
└── bcrypt / class-validator / xlsx

Frontend（由 ADMINCLIENT 提供）
└── Vue 3 + TDesign（通过 /hippoadmin 访问本服务）
```

## 安装方式

环境要求：Node.js >= 18（推荐 20 LTS）。

```bash
# 1. 安装依赖
npm install

# 2. 配置 .env（可参考 .env.example）
#    - JWT_SECRET：签名密钥
#    - DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_DATABASE

# 3. 创建本地数据库
#    默认库名 etp_default_sql；首次启动 synchronize=true 自动建表；
#    种子数据可通过前端“系统设置 → 恢复默认”导入 default.sql

# 4. 启动服务（开发模式，监听 5004，接口前缀 /hippoadmin）
npm run start:dev

# 生产构建与启动
npm run build
npm run start:prod
```

常用脚本（以 `package.json` 为准）：`start` / `start:dev` / `start:debug` / `start:prod` / `build` / `lint` / `format` / `test` / `test:e2e`。

数据库说明：数据库运行于本机 `127.0.0.1`（`DB_HOST=127.0.0.1`）。数据库名称、账号密码可按本地环境在 `.env` 中调整。

> 相关前端工程：[ADMINCLIENT](../ADMINCLIENT/README.md)

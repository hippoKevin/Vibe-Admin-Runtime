# 汇创 ADMIN · ADMINSERVER（服务端）

汇创管理端（底座 V1.0.0）的 **NestJS 服务端**，基于 NestJS 10 + TypeORM + MySQL 构建，提供登录认证（JWT）、用户 / 角色 / 菜单权限（RBAC）、数据导入、文件上传与“恢复默认”等能力。数据库默认本机 `127.0.0.1`，通过 `.env` 配置。

## 文档

- [中文文档](docs/README.zh-CN.md)
- [English Documentation](docs/README.en-US.md)

## 快速开始

```bash
npm install         # 安装依赖
# 参考 .env.example 配置 .env（JWT_SECRET 与 DB_*，DB_HOST=127.0.0.1）
npm run start:dev   # 开发（热重载，监听 5004，接口前缀 /hippoadmin）
npm run build && npm run start:prod   # 生产
```

相关前端工程：[ADMINCLIENT](../ADMINCLIENT/README.md)

© Kevin Mao

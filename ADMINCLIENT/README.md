# 汇创 ADMIN · ADMINCLIENT（前端）

汇创管理端（底座 V1.0.0）的 **Web 管理前端**，基于 Vue 3 + TypeScript + Vite + TDesign Vue Next 构建，内置用户 / 角色 / 菜单权限、数据导入、列模板配置等后台底座能力；开发环境开启 Mock 后页面直接使用 `mock/` 目录的 JSON 数据演示，不请求后端。

## 文档

- [中文文档](docs/README.zh-CN.md)
- [English Documentation](docs/README.en-US.md)

## 快速开始

```bash
npm install       # 安装依赖
npm run dev       # 开发（默认 http://localhost:5009，接口代理 127.0.0.1:5004）
npm run build     # 生产构建
```

## ADMIN展示(show)

### login page
![登录页面](./docs/images/login.png)

### user management
![用户管理](./docs/images/userManagement.png)

相关服务端工程：[ADMINSERVER](../ADMINSERVER/README.md)

© Kevin Mao

# 汇创 ADMIN · 前端（ADMINCLIENT）

## 系统介绍

汇创 ADMIN（汇创管理端底座）的 Web 管理前端。系统面向企业内部日常管理场景，提供用户、角色、菜单与权限（RBAC）、数据导入、列模板配置等开箱即用的后台管理能力。

整个系统支持在本地独立运行与演示：

- 前端开发服务器默认监听 `http://localhost:5009`；
- 后端接口地址默认为本机 `127.0.0.1:5004`；
- **开发环境开启 Mock（`VITE_ENABLE_MOCK = true/force`）时，页面直接使用 `mock/` 目录中的 JSON 数据，不会请求后端**（生产环境不会启用）。

## 当前系统功能

- 登录与 Token 刷新（JWT）
- 用户管理：账号/用户/职务/手机/邮箱/性别 增删改查
- 角色管理：角色 CRUD 与菜单/按钮权限配置
- 菜单管理：目录与菜单维护、菜单排序、操作（按钮级接口）管理
- 菜单列模板配置：自定义列表列标题/字段/宽度/排序/显示
- 数据导入：Excel 单表导入、批量导入、导入历史
- 个人中心：查看与修改个人信息
- 修改密码
- 系统设置与“关于我们”（公众号 / GitHub / Bilibili）
- 恢复默认（重置本地数据库为种子数据）
- 中英文国际化、主题色与暗黑模式切换、菜单全局检索
- 开发模式自动 Mock 数据支持

## 技术架构

```text
Frontend
├── Vue 3
├── TypeScript
├── Vite
├── Pinia
├── Vue Router
├── TDesign Vue Next
└── vue-i18n

Backend（由 ADMINSERVER 提供）
├── NestJS
├── TypeORM
└── MySQL（默认 127.0.0.1）

Development
└── Mock JSON（mock/ 目录）
```

## 安装方式

环境要求：Node.js `^20.19.0 || >=22.12.0`。

```bash
# 1. 安装依赖
npm install

# 2. 启动前端开发服务器（默认 http://localhost:5009）
npm run dev

# 3. 生产构建 / 本地预览
npm run build
npm run preview

# 4. 类型检查 / Lint
npm run type-check
npm run lint

# 5. E2E 测试（可选，需先安装 Playwright 浏览器）
npx playwright install
npm run test:e2e
```

环境变量（`ADMINCLIENT/.env.development` / `.env.production`）：

| 变量 | 说明 | 开发默认 | 生产默认 |
| ---- | ---- | ---- | ---- |
| `VITE_OPEN_CLIENT` | 开发服务器监听地址 | `0.0.0.0` | - |
| `VITE_OPEN_CLIENT_PORT` | 开发服务器端口 | `5009` | - |
| `VITE_SERVER_URL` | 后端接口地址（代理目标） | `127.0.0.1:5004` | `127.0.0.1:5004` |
| `VITE_ENABLE_MOCK` | 是否允许自动 Mock（仅开发环境生效） | `true` | `false` |

## Mock 使用方式

开发环境下，当后端无法连接时，系统会自动使用 `mock/` 目录中的 JSON 数据，无需改动任何业务页面。

- Mock 数据存放位置：`ADMINCLIENT/mock/*.json`
  - `users.json`（用户）、`roles.json`（角色）、`menus.json`（菜单）、`menu_status.json`（列模板）、`operations.json`（操作）、`ports.json`（接口）、`import_history.json`（导入历史）
- Mock 数据与真实后端返回结构保持一致（`code: 2000 / message / data`），业务层无需区分真实数据与 Mock 数据
- 开关：`.env.development` 中 `VITE_ENABLE_MOCK = true` 或 `force` 时启用**纯 Mock 模式**——所有已映射接口直接返回 `mock/` 数据，完全不请求后端；设成 `auto` 则先请求后端、失败才自动切换；`.env.production` 必须为 `false`，生产环境不会返回 Mock 数据
- 修改环境变量后需要重启 `npm run dev` 才生效
- Mock 演示账号：`admin / 123456`、`viewer / 123456`

> 相关服务端工程：[ADMINSERVER](../ADMINSERVER/README.md)

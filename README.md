# HC ETP

> Vue3 + NestJS + AI Agent 全栈企业后台开发学习项目

## 项目介绍

HC ETP 是一个面向学习和研究的全栈企业后台开发项目。

项目采用 Monorepo 结构，将：

* 前端 ADMINCLIENT
* 后端 ADMINSERVER
* AI Agent ADMINAGENT
* QuickStart 启动管理

统一维护在同一个仓库中。

项目目标：

通过学习企业级后台系统的完整开发流程，了解：

* 前后端分离架构
* 企业级后台系统设计
* API 设计
* 权限管理
* AI Agent 辅助开发

---

# ⚠️ 使用声明

本项目仅用于：

* 学习
* 技术交流
* 个人研究

禁止：

* 商业用途
* 未授权商业部署
* 二次商业售卖

如果用于学习或个人研究，可以自由查看和修改代码。

---

# 项目结构

```text
HC-ETP/

├── ADMINCLIENT
│   └── Vue3 前端项目
│
├── ADMINSERVER
│   └── NestJS 后端项目
│
├── ADMINAGENT
│   └── AI Agent 与 Skill 系统
│
├── QuickStart
│   └── 项目统一启动入口
│
└── README.md
```

---

# 项目模块

## 前端 ADMINCLIENT

基于：

* Vue3
* TypeScript
* Vite
* TDesign Vue Next

负责：

* 页面开发
* 组件开发
* 状态管理
* 前端路由
* API 调用

详细说明：

👉 [查看 ADMINCLIENT 前端文档](./ADMINCLIENT/README.md)

---

## 后端 ADMINSERVER

基于：

* NestJS
* TypeScript
* TypeORM

负责：

* 服务端接口
* 数据管理
* 业务逻辑
* 权限系统

详细说明：

👉 [查看 ADMINSERVER 后端文档](./ADMINSERVER/README.md)

---

## AI Agent ADMINAGENT

ADMINAGENT 是项目未来 AI 开发能力模块。

当前规划：

* DeepSeek Harness
* Agent
* Skill 系统

主要用于：

* 理解项目结构
* 自动修改代码
* 自动检查
* 自动测试

详细说明：

👉 [查看 ADMINAGENT 文档](./ADMINAGENT/README.md)

---

# QuickStart

QuickStart 用于统一启动整个开发环境。

启动：

```bash
quick_start.bat
```

启动流程：

```text
QuickStart

    |
    |
    +------ ADMINSERVER
    |
    |
    +------ ADMINCLIENT
```

启动成功：

```text
Backend:
http://localhost:3000


Frontend:
http://localhost:5173
```

---

# Git 分支说明

当前项目采用：

```
main
```

作为唯一开发分支。

项目所有模块统一维护：

```
main

├── ADMINCLIENT
├── ADMINSERVER
├── ADMINAGENT
└── QuickStart
```

---

# 学习路线建议

推荐学习顺序：

## 1. 前端

学习：

* Vue3 基础
* TypeScript
* TDesign 组件
* 状态管理
* API 调用

进入：

[ADMINCLIENT](./ADMINCLIENT)

---

## 2. 后端

学习：

* NestJS
* Controller
* Service
* Entity
* 数据库交互

进入：

[ADMINSERVER](./ADMINSERVER)

---

## 3. AI Agent

学习：

* Harness
* Skill 设计
* Agent 工作流

进入：

[ADMINAGENT](./ADMINAGENT)

---

# Roadmap

## 基础全栈阶段

* [x] Vue3 前端
* [x] NestJS 后端
* [x] 前后端统一仓库
* [x] QuickStart 启动器

## AI 开发阶段

* [ ] DeepSeek Harness 接入
* [ ] Frontend Skill
* [ ] Backend Skill
* [ ] 自动代码检查
* [ ] 自动测试

---

# License

本项目仅供学习交流使用。

禁止商业用途。

````
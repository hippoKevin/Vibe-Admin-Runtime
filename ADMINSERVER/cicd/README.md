# 后端 CI/CD

本目录是**后端专属的 CI/CD 目录**：流水线要执行的逻辑全部放在这里，
GitHub Actions 只负责「触发 + 调用脚本」，因此**本地、服务器、CI 三处行为一致**，
排查问题时不用去翻 workflow 里的散装命令。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `common.sh` | 公共函数：定位目录、选择包管理器、安装依赖、执行 npm/pnpm 脚本 |
| `install.sh` | 安装依赖（CI 与部署共用） |
| `build.sh` | 安装依赖 + `nest build`；`RUN_TESTS=1` 时额外跑单元测试 |
| `deploy.sh` | 服务器端部署：拉代码 → 装依赖 → 构建 → 重启 PM2 → 健康检查 |
| `restart.sh` | PM2 重启后端（应用名取 `PM2_APP_NAME`，默认 `main`） |
| `health-check.sh` | 轮询 `/hippoadmin/system-ops/ping`，判断服务是否恢复 |

## 手动使用

```bash
# 只构建（CI 用；加 RUN_TESTS=1 跑单元测试）
bash ADMINSERVER/cicd/build.sh
RUN_TESTS=1 bash ADMINSERVER/cicd/build.sh

# 服务器部署（在服务器仓库根目录执行）
DEPLOY_BRANCH=main PM2_APP_NAME=main bash ADMINSERVER/cicd/deploy.sh

# 只重启 / 只做健康检查
PM2_APP_NAME=main bash ADMINSERVER/cicd/restart.sh
bash ADMINSERVER/cicd/health-check.sh
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PKG_MANAGER` | 自动 | `pnpm` / `npm`；默认「存在 `pnpm-lock.yaml` 且装了 pnpm」就用 pnpm |
| `DEPLOY_BRANCH` | `main` | 部署分支 |
| `SKIP_GIT` | `0` | `1` = 跳过拉代码，只重新构建与重启 |
| `PM2_APP_NAME` | `main` | PM2 应用名，需与 `ecosystem.config.js` 的 `name` 一致 |
| `HEALTH_CHECK_URL` | `http://127.0.0.1:5004/hippoadmin/system-ops/ping` | 健康检查地址 |
| `HEALTH_CHECK_RETRIES` / `HEALTH_CHECK_INTERVAL` | `15` / `2` | 重试次数 / 重试间隔（秒） |
| `RUN_TESTS` | `0` | `1` = 构建后执行单元测试 |

## GitHub Actions 需要的配置

仓库 `Settings → Secrets and variables → Actions`：

**Secrets**

| 名称 | 说明 |
| --- | --- |
| `SSH_HOST` | 服务器地址 |
| `SSH_USER` | 登录用户 |
| `SSH_PRIVATE_KEY` | 部署私钥（公钥需写入服务器 `~/.ssh/authorized_keys`） |
| `SSH_PORT` | 可选，默认 `22` |

**Variables**

| 名称 | 说明 |
| --- | --- |
| `DEPLOY_PATH` | 服务器上仓库的绝对路径，例如 `/www/Vibe-Admin-Runtime` |
| `PM2_APP_NAME` | 可选，默认 `main` |
| `DEPLOY_WEB` | 填 `true` 才会执行前端发布任务 |
| `WEB_PATH` | 前端发布目录（nginx 站点根目录），`DEPLOY_WEB=true` 时必填 |

## 服务器前置条件

- Node 20+、`git`、`curl`、`pm2`（`npm i -g pm2`）
- PM2 应用名与 `ADMINSERVER/ecosystem.config.js` 的 `name` 一致（默认 `main`）
- ⚠️ `ecosystem.config.js` 目前写的是 `cwd: '/www/main'`。
  改成 monorepo 布局后，后端实际路径是 `<DEPLOY_PATH>/ADMINSERVER`，
  需要同步把 `cwd` 改成该目录，否则 PM2 找不到 `dist/main.js`。

## 流水线

| 工作流 | 触发 | 内容 |
| --- | --- | --- |
| `.github/workflows/ci-server.yml` | 改动 `ADMINSERVER/**` 推送到 main/develop、PR、手动 | 装依赖 → 构建 → 单元测试 → 上传 `dist` 产物 |
| `.github/workflows/ci-client.yml` | 改动 `ADMINCLIENT/**` 推送到 main/develop、PR、手动 | `npm ci` → 类型检查 + 构建 → 上传 `dist` 产物 |
| `.github/workflows/cd-server.yml` | 手动触发、推送 `v*` 标签 | SSH 到服务器执行 `ADMINSERVER/cicd/deploy.sh`；`DEPLOY_WEB=true` 时额外发布前端 |

## 与「系统运维」页面的联动

- 页面上的「保存并重启」：PM2 托管时会 `process.exit(0)`，由 PM2 自动拉起，
  与 `restart.sh` 效果一致；
- 保存 `.env` 前会自动备份到 `<ADMINSERVER>/backup/env/`（已在 `.gitignore` 忽略）；
- 运行日志按天写入 `<ADMINSERVER>/logs/`；
  健康检查失败时用 `pm2 logs <PM2_APP_NAME> --lines 100`
  或页面「系统日志」页签查看。

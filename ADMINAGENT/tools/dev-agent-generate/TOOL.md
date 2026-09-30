# dev-agent-generate

## 作用
把一句自然语言任务（例如「把系统日志页的摘要列换成标签展示」）交给 DeepSeek Harness 执行，
由 Agent 直接修改本仓库代码；前端 Vite 会热更新，页面随之实时变化。

## 何时使用 / 不要使用
- 适用：需要改动本仓库前端/后端代码、且可以用一句话描述清楚的任务。
- 不适用：需要人工确认的高风险改动（删库、改权限模型）、与代码无关的问答。

## 入参
| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `prompt` | string | 是 | 一句话任务描述，建议包含目标页面/文件与验收标准 |
| `cwd` | string | 否 | 执行目录，默认仓库根目录 |

## 返回
```json
{
  "ok": true,
  "exitCode": 0,
  "duration": 48213,
  "output": "Agent 的最终答复（已截断）",
  "reasoningTail": "推理过程尾部（stderr，已截断）",
  "files": [{ "status": "M", "path": "ADMINCLIENT/src/pages/SystemOps/Log/index.vue" }]
}
```

## 安全与副作用
- **会写文件**：Agent 以仓库根目录为工作目录，可能修改任意受版本控制的文件；
  改动前后可用 `git diff` 复核，误改可 `git checkout -- <path>` 回滚。
- 同一时间只允许一个任务在跑（服务内有并发锁）。
- 每次调用都会写入操作审计，可在「系统运维 → 系统日志」查看。
- 超时（默认 5 分钟）会被强制结束并返回失败。

## 实现位置
- 后端：`ADMINSERVER/src/services/system/dev-agent.service.ts`
- 接口：`POST /hippoadmin/dev-agent/generate`、`GET /hippoadmin/dev-agent/status`
- 调用方：「开发模式」浮层（`ADMINCLIENT/src/components/DevModeTool/`）

## 底层命令
```bash
dsh --profile headless "<prompt>"     # stdout 为最终答复，退出码 0 表示完成
```
CLI 解析顺序：环境变量 `DSH_CLI_PATH` → PATH 中的 `dsh` → 本机 DSH 安装目录
（`%LOCALAPPDATA%`/`D:\software\deepseek-harness\resources\runtime\cli\bin\dsh.cmd`）。

# Agent 管理 · agent

这里定义「有哪些 Agent、各自负责什么、能挂哪些技能与工具」。

## 一个 Agent 长什么样

```
agent/<agent-name>/
├── AGENT.md     # 必需：人设、职责边界、可用技能与工具
└── config.json  # 可选：模型、温度、工具白名单
```

`AGENT.md` 建议包含：

```markdown
# <agent-name>

## 角色
一句话人设。

## 职责
- 负责……
- 不负责……（写清楚边界，避免越权改代码）

## 挂载技能
| 技能 | 用途 |
| --- | --- |
| `skills/Frontend` | 写前端页面对齐设计规范 |
| `skills/Backend` | 写接口/实体时对齐后端规范 |

## 挂载工具
| 工具 | 用途 |
| --- | --- |
| `tools/dev-agent-generate` | 接收任务并落地代码改动 |

## 交付标准
改完必须能通过 `npm run build-only`、类型检查不新增错误、i18n 中英文同步。
```

## 当前 Agent

| Agent | 说明 |
| --- | --- |
| `vibe-admin/` | 管理端开发 Agent：按 `skills/Frontend`+`skills/Backend` 改这套底座代码，「开发模式」默认用它 |

## 与 harness 的关系

DSH 的 Agent 由「组合包（bundle）+ 技能 + 工具」装配：
- 通用能力（模型接入、Agent Loop、会话持久化）来自 `harness/`；
- 本目录只描述**业务侧的人设与装配清单**，通过 CLI 参数或 harness 配置注入。

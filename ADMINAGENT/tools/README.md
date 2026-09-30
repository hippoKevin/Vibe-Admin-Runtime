# 工具管理 · tools

这里存放 Agent 能**实际调用**的动作（代码形态），与 `../skills/`（提示词形态的做法规范）区分开。

## 一个工具长什么样

```
tools/<tool-name>/
├── TOOL.md      # 必需：给人和 Agent 看的说明
├── schema.json  # 可选：入参 JSON Schema（Agent 据此调用）
└── index.ts     # 可选：Node 侧实现
```

`TOOL.md` 建议包含：

```markdown
# <tool-name>

## 作用
一句话说明它能干什么。

## 何时使用 / 不要使用
给 Agent 的判断依据。

## 入参
| 名称 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |

## 返回
成功与失败分别是什么结构。

## 安全与副作用
是否写文件、是否发请求、是否需要二次确认。

## 实现位置
index.ts 或对应的后端接口路径。
```

## 目录里已有哪些工具

| 工具 | 说明 |
| --- | --- |
| `dev-agent-generate/` | 把一句自然语言任务交给 DSH 执行并改代码（后端 `POST /hippoadmin/dev-agent/generate`），「开发模式」用的就是它 |

## 与 harness 的边界

- 工具实现优先放在**本仓库**（Node 脚本或 NestJS 接口），这样能进代码评审与审计；
- 只有当某个工具具备通用价值时，才考虑提到 DSH 上游或放到 `harness/patches/`。

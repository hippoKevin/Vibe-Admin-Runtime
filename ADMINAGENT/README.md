# 智能管理 · ADMINAGENT

这里是「汇创管理端」的智能体能力区，四块内容各司其职、互不重叠：

| 目录 | 作用 | 权威来源 |
| --- | --- | --- |
| `harness/` | 开源的 **DeepSeek Harness（DSH）** 源码，Agent 运行时本体（模型、工具、Agent Loop 全是插件） | 上游 MIT 协议项目，见 `harness/LICENSE` |
| `skills/` | **技能管理**：告诉 Agent「这类活该怎么干」，一个技能一个目录，入口固定为 `SKILL.md` | 与 DSH 的 `.agents/skills/<name>/SKILL.md` 约定一致 |
| `agent/` | **Agent 管理**：Agent 的人设、职责边界、可挂载的技能与工具清单 | 本目录的 `README.md` |
| `tools/` | **工具管理**：Agent 能调用的具体动作（读写文件、调接口、跑脚本…） | 本目录的 `README.md` |

> `skills/Workspace` 是**优先级最高**的技能：harness 在本机是全权限运行的，
> 这个技能规定它**只允许改动本工作区内的文件**，并且**每次改动都必须留下 git 记录**、
> 任何时刻都能用提交 sha 拉回（配套脚本 `skills/Workspace/scripts/commit-workspace.mjs`
> 会做边界、黑名单与体积检查，并打印 `git revert` 之类的回退命令）。

## 为什么这么分

- **skill ≠ tool**：技能是「做法/规范」（提示词形态，教 Agent 怎么思考），工具是「能力」（代码形态，让 Agent 真能动手）。
  Agent 由「人设 + 技能 + 工具」装配而成，所以三者分开放，才能被不同 Agent 复用。
- **harness 是底座**：它提供 Agent Loop、模型接入、工具调用协议与会话持久化；
  我们的 `skills/ agent/ tools/` 通过它的插件/技能机制挂进去。

## 目录约定（务必遵守）

```
ADMINAGENT/
├── harness/                     # 上游源码，不要改（要改就提到上游或放 patches）
├── skills/
│   └── <SkillName>/
│       ├── SKILL.md             # 必需：技能入口
│       ├── rules/               # 可选：细则文档
│       └── workflow/            # 可选：流程步骤
├── agent/
│   └── <agent-name>/
│       ├── AGENT.md             # 必需：人设、职责、可用技能与工具
│       └── config.json          # 可选：模型、温度、允许的工具白名单
└── tools/
    └── <tool-name>/
        ├── TOOL.md              # 必需：工具说明与入参/出参
        └── index.ts             # 可选：实现（Node 侧脚本）
```

## 与系统运行时的关系

- 管理端「**开发模式**」（顶栏调色盘左边的按钮）负责采集语音 → 转成任务文本 →
  调后端 `POST /hippoadmin/dev-agent/generate`。
- 后端 `DevAgentService` 以项目根目录为工作目录执行
  `dsh --profile headless "<任务>"`，Agent 直接改仓库里的文件，
  Vite 的 HMR 会让页面**实时变化**（这就是「说完话 → 生成代码 → 系统实时变换」的链路）。
- 每次执行都会被操作审计记录（`operation_log`），可在「系统日志」里看到。

## 新增技能/工具的流程

见 `skills/Frontend/workflow/new-page.md` 的同款思路：
先写 `SKILL.md`/`TOOL.md` 描述清楚，再补实现，最后在 `agent/<name>/AGENT.md` 里把它挂到某个 Agent 上。

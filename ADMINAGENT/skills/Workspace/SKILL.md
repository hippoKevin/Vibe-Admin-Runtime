# Workspace · 工作区边界与可回退提交

| 项 | 值 |
| --- | --- |
| 名称 | `Workspace` |
| 作用域 | **所有**在本仓库里干活的 Agent（含 harness / DSH 全权限模式） |
| 优先级 | **最高**：与任何其它技能冲突时，以本技能的边界与提交规则为准 |
| 配套脚本 | `scripts/commit-workspace.mjs` |

---

## 作用

harness（DSH）在本机是**完全权限**运行的 —— 它能读写这台机器上的任何文件。
权限越大，越需要纪律。本技能只做两件事：

1. **边界**：只允许改动**本工作区**（本仓库根目录及其子目录）内的文件；
2. **留痕**：每一次改动都必须在 git 里有记录，任何时刻都能**拉回**到改动前的状态。

## 何时使用

- **任何时候**：只要 Agent 要改文件、跑生成、批量重命名、删除文件，都先按本技能执行。
- 不适用：只读分析、回答问题、不改动文件的任务（不需要提交，但**边界照样适用**）。

## 硬性规则

### 一、边界：只动工作区里的文件

1. **工作区根目录**就是本仓库根目录（`git rev-parse --show-toplevel` 的输出）。
   本仓库是：`汇创管理端（底座V1.0.0）`（ADMINCLIENT / ADMINSERVER / QuickStart / ADMINAGENT）。
2. **绝对不要**改动工作区之外的任何路径，包括但不限于：
   - `D:\software\deepseek-harness\**`（DSH 安装目录，改它会影响所有项目）
   - `C:\Users\**`、`%TEMP%` 之外的系统目录、其它项目的仓库
   - 任何以绝对路径出现、且不在工作区根目录下的路径
3. **不要**在工作区里创建指向外部的大文件/软链；不要把 `node_modules`、`dist`、
   `ADMINAGENT/harness/docs|.agents|snapshots`（已在根 `.gitignore` 排除）提交进仓库。
4. 需要临时文件时，放在**工作区内**且能被 `.gitignore` 覆盖的位置
   （例如 `ADMINCLIENT/.build-tmp/`），用完即删。
5. 如果任务确实需要动工作区之外的东西（例如升级 DSH 本体），**先停下来问人**，
   不要自己动手。

### 二、留痕：每次改动都要有 git 记录

1. 开跑前先确认工作区状态：`git status --short`。
   - 有**别人**的未提交改动 → 不要顺手带上，只提交你自己改的文件。
2. 改完一个**逻辑单元**就提交一次（不要攒一大坨）：
   - 提交信息用 Conventional Commits + 中文描述，遵循本仓库既有风格：
     `fix(client): …` / `feat(server): …` / `docs(skills): …`
   - 第二个 `-m` 起写「为什么改、怎么验证的」，别只写「update」。
3. 提交前**只 stage 自己改的文件**（精确路径，别用 `git add -A`）。
   推荐直接用配套脚本，它会帮你做边界与体积检查、并把回退命令打出来。
4. 提交后**推送**（本仓库远端：`Vibe-Admin-Runtime`）：
   - 直连 GitHub 不稳定时用代理：`git -c http.proxy=http://127.0.0.1:7892 push`
5. 大文件（>5MB）会被脚本拦下：先确认是不是该提交（通常不该）。

### 三、随时拉回：回退手册

| 目的 | 命令 |
| --- | --- |
| 看这次改了什么 | `git show --stat <sha>` / `git diff <sha>~1 <sha>` |
| 只撤销某个文件 | `git checkout -- <path>`（未提交时）/ `git checkout <sha>~1 -- <path>` |
| 反转某次提交（保留历史，最安全） | `git revert <sha>` |
| 丢弃工作区未提交改动 | `git restore --source=<sha> --staged --worktree -- <path>` |
| 整仓回到某个提交（**危险，先确认**） | `git reset --hard <sha>` |
| 从远端拉回某个提交的版本 | `git fetch && git checkout <sha> -- <path>` |

> 只要遵守"每次都提交"，上面任何一条都能把你拉回任意一个历史状态 ——
> 这就是本技能存在的意义。

## 工作流（照做即可）

```bash
# 0. 进工作区，确认根目录与状态
git rev-parse --show-toplevel      # 必须等于本仓库根
git status --short

# 1. 干活（只动工作区内的文件）

# 2. 自检（按项目约定）
cd ADMINCLIENT  && npm run build-only    # 前端
cd ADMINSERVER  && npm run build         # 后端

# 3. 提交（脚本会做边界/体积检查并打印回退命令）
node ADMINAGENT/skills/Workspace/scripts/commit-workspace.mjs "fix(client): 修复某某问题" --all
# 或指定文件：
node ADMINAGENT/skills/Workspace/scripts/commit-workspace.mjs "feat(server): 新增某某接口" --files "ADMINSERVER/src/xxx.ts,ADMINCLIENT/src/yyy.vue"

# 4. 推送
git push        # 需要时加 -c http.proxy=http://127.0.0.1:7892
```

## 边界自检清单（提交前逐条过）

- [ ] 改动的每个路径都在工作区根目录之内（没有 `..`、没有盘符跳转）
- [ ] 没有把别人的未提交改动顺手提交
- [ ] 没有提交 `node_modules` / `dist` / 大文件 / 密钥（`.env` 里的真实口令）
- [ ] 构建通过（前端 `build-only`、后端 `build`）
- [ ] 提交信息说清了「改了什么 + 为什么 + 怎么验证的」
- [ ] 提交后记下了 sha（回退要用）

## 与其它技能的关系

- `Frontend` / `Backend` 管**怎么写代码**；本技能管**能改哪里、怎么留痕**。
- 开发模式（顶栏那颗球）驱动的 Agent 同样受本技能约束：
  它用的是 `dsh --profile headless`，工作目录就是本仓库根目录，
  所以它**本来就在工作区内**动文件；本技能保证它每次动完都有提交可回退。

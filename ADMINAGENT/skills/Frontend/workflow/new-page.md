---
enabled: true
---

# 工作流 · 新增一个前端页面

> 配套规范见 `../SKILL.md`。按顺序执行，不要跳步。

## 1. 建目录与文件

```
src/pages/<业务组>/<页面名>/index.vue        页面主体（name 与菜单 component_name 一致）
src/pages/<业务组>/<页面名>/api.ts           该页面的接口
src/pages/<业务组>/<页面名>/index.scss       样式（较大时独立）
src/pages/<业务组>/<页面名>/components/...   页内弹窗/子页面（可选）
```

页面骨架、script 顺序、样式与 i18n 写法一律照 `../SKILL.md` 的「三、四、八、九」。

## 2. 写接口层

在页面目录 `api.ts` 里按「动词 + 资源」命名导出函数，统一走 `requestApi`，
每个函数写一行中文 JSDoc，成功码判断 `res.code === 2000`。

## 3. 补 i18n

`src/locales/zh-CN.ts` 与 `en-US.ts` **同步**新增功能分组（如 `systemOpsLog: {...}`）；
能复用 `common.*` 的一律复用。

## 4. 在菜单里登记（路由由后端菜单驱动）

两种方式，任选：

- **界面**：系统管理 → 菜单管理 → 新增，填写
  - 菜单名称、图标（`server`、`dashboard` 等 stem）
  - 类型：菜单
  - 组件名称：与页面 `name` 完全一致（如 `SystemOpsLogPage`）
  - 组件地址：下拉里选 `/src/pages/<业务组>/<页面名>/index.vue`
  - 父级：选所在目录
- **接口**：用 `QuickStart/create_system_ops_menu.js` 这类脚本调
  `/hippoadmin/menu/addMenu` 创建（可 `--dry-run` 预览、可重复执行）

随后到「系统管理 → 角色管理 → 权限配置」把新菜单勾给需要的角色（或用脚本的 `--grant-role`）。

## 5. 让表格列可配置（有 `t-table` 时）

到「系统管理 → 菜单配置」给这个菜单新增一条列模板，页面用 `useColumnConfig()` 加载；
不配置也能跑（后端会返回默认列）。

## 6. 本地验证

```powershell
cd ADMINCLIENT
npm run build-only          # 必须通过（CI 的阻断项）
npm run type-check          # 不要新增错误
```

浏览器里重点看：菜单能否打开、KeepAlive 切页是否保留、字号缩放（右上角字号工具）下文字是否一致、
明暗模式与主题色是否正常。

## 7. 提交与推送

```powershell
git add ADMINCLIENT/src/pages/... ADMINCLIENT/src/locales/...
git commit -m "feat(client): 新增 XXX 页面"
git push
```

CI 会自动跑（改了 `ADMINCLIENT/**` 触发 CI · Client）：`npm ci` → `build-only` → `type-check`（暂不阻断）。
**注意 import 路径大小写**：Windows 能过、Linux 会失败，这是最常见的 CI 红。

# UI 技术方案（Vue + Tailwind + shadcn-vue）

> 本文定义前端 UI 层统一技术栈与规范，供后续各版本复用。属于“实现/方案层”，由 `docs/design.md` 引用。

## 1. 技术栈
- 框架：Vue 3 + TypeScript
- 样式：Tailwind CSS v4（通过 `@tailwindcss/postcss` 插件接入）
- 组件：shadcn-vue（依赖 radix-vue），组件按需拉取
- 图标：Uno Icons（`lucide` 源），通过 `unplugin-icons` 自动导入（前缀 `icon-lucide-*`）

## 2. 工程与基础配置
- Vite：
  - `resolve.alias` 配置 `@ -> src`（同时在 `tsconfig*.json` 中设置 `paths`）。
  - 开发中间件：`/data/*` 静态读取仓库根 `data/`；`POST /__data/save` 本地写回（dev-only）。
- Tailwind：
  - `src/style.css` 仅包含 `@import "tailwindcss";`；
  - 通过 `postcss.config.js` 启用 `@tailwindcss/postcss`；
  - 主题变量采用 shadcn 风格映射，并统一设置主色为 sky 调（`--primary: rgb(224 242 254)` 等）。
- shadcn-vue：
  - 通过 `npx shadcn-vue init` 初始化；
  - 使用 `npx shadcn-vue add <component>` 按需引入（Button/Input/Select/Dialog/Tooltip/…）。
- Icons：
  - `unplugin-icons` + `Components`（仅启用解析器，关闭本地组件自动注册），使用 `<icon-lucide-*>`。

## 3. 组件使用规范
- 倾向“直接使用 shadcn 官方组件”，非必要不再自封装；
- 业务复用抽象采用“轻薄壳组件”，仅聚合布局/事件，不复制交互逻辑；
- 列表条目抽离为行组件，例如：`components/workitem/WorkItemRow.vue`，页面只管数据与事件转发。

## 4. 交互与可访问性
- 统一采用 shadcn 组件的交互与可访问规范（焦点环、键盘导航、ARIA）；
- Tooltip/Toast 等反馈组件优先使用 shadcn 实现；
- 错误处理：弹窗内操作优先本地校验（如 JSON 格式），失败只提示不崩溃。

## 5. 主题与视觉
- 主色系：sky（浅色为主，`--ring` 使用 `sky-100`）。
- 标题示例：侧栏标题 `Hubble Pad` 使用 `text-blue-500` 并配合 Tooltip 文案“极简的私人工作站”。

## 6. 目录建议
```
web/
  src/
    components/
      ui/            # shadcn 组件（由 CLI 生成）
      workitem/      # 业务轻壳组件 e.g. WorkItemRow.vue
    composables/     # 数据加载/过滤 hooks
    types/           # 领域类型
    style.css        # Tailwind 入口 + 主题变量
```

## 7. 扩展路线
- 后续引入 Toast、Dropdown、Tabs 等通用组件；
- 列表虚拟化（大数据时）；
- 主题切换（浅/深）。

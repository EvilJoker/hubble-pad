# RFC-002: 数据钩子更新机制

状态：Provisional | 所属层：方案层 | 变更范围：数据更新流程与文件结构

## 目标
- 保持单文件事实源：`data/workitems.json`。
- 钩子输出统一响应对象 `{ ok: boolean, items: WorkItem[], error?: string }`（增量/全量均可），系统负责合并落盘；遵循“最后写入者覆盖（LWW）”。

## 范围
- 执行方式：仅支持“手动触发”（开发环境或本地操作，通过 UI/接口），本阶段不考虑定时/CI。
- 平台适配：每个平台一个独立脚本（如 `github-repos`），互不影响、可串行执行。
- 管理与可视化：左侧 Hooks 列表可新增/启用/编辑/删除配置；可运行单个或全部脚本。

## 合同与文件
- 脚本输出（stdout）：统一为对象
  - 成功：`{ ok: true, items: WorkItem[] }`
  - 失败：`{ ok: false, error: string, items?: WorkItem[] }`
  - WorkItem 至少包含 `id/title/description/url`（string），可含 `kind/attributes`；**不建议脚本直接写入 `storage` 字段**（该字段由本地系统维护，用于存放本地扩展信息）
- 合并与落盘：系统读取脚本输出中的 `items`，按 `id` 合并到 `data/workitems.json`（整条覆盖，LWW），但会**保留已有条目的 `storage` 字段**（如 `storage.records` 的变更记录）。
- 元数据：系统在合并时为条目补充 `source="hook:<id>"` 与 `updatedAt`（ISO 时间）。
- 配置文件：`data/hooks.json` 管理脚本清单（不删除真实脚本）。

### hooks.json 结构（示例）
```json
[
  {
    "name": "GitHub 组织仓库",
    "desc": "拉取 org 仓库入口",
    "cmd": "node data/hooks/github_repos.js",
    "cwd": "./",
    "enabled": true,
    "lastRunAt": null,
    "lastError": null
  }
]
```

## 执行与接口（dev 中间件）
- GET `/__hooks/list` → 返回 `hooks.json` 内容
- POST `/__hooks/add` → 新增配置（name/desc/cmd/cwd/enabled）
- POST `/__hooks/update/{index}` → 修改配置（按列表下标或 name 约定）
- POST `/__hooks/toggle/{index}` → 启用/停用
- POST `/__hooks/delete/{index}` → 移除配置（不删除 `data/hooks/` 下脚本）
- POST `/__hooks/run/{index}` → 执行单脚本，合并写入；返回 {status, added, updated, error, lastRunAt}
- POST `/__hooks/run-all` → 执行所有 `enabled=true` 的脚本，按顺序合并

## 降级与容错
- 脚本失败：跳过合并，记录 `lastError`，UI tooltip 展示；其他脚本不受影响。
- 写入失败：保留旧 `workitems.json` 并返回错误；下次可重试。
- Schema 校验：
  - 钩子输出对象：必须包含 `ok`（boolean）；当 `ok=true` 时必须包含 `items` 数组；当 `ok=false` 可选 `error`。`items` 内元素满足最小 WorkItem 约束。
  - `WorkItem[]`（写入 `data/workitems.json` 前）：必须为数组，且每个元素包含 `id/title/description/url`（string）。
  - `hooks.json`：必须为数组，且每个元素包含 `name`（string）、`cmd`（string）、`enabled`（boolean），其余为可选。
  - 失败拒写，返回 400。
- 原子写：先写临时文件再 rename，避免部分写入。

## 安全与凭证
- 本阶段忽略凭证与鉴权问题；仅在本地/开发环境手动触发脚本。

## UI 约束（摘要）
- 左侧 Hooks 列表：新增脚本、启用开关、编辑、删除（仅删配置）、运行按钮、最后执行时间与错误 tooltip；顶部“运行全部”。
- 删除仅清理 `hooks.json` 配置，不删除 `data/hooks/` 下脚本实体。

## 待确认
- 是否需要 hooks 级 `timeoutMs`、重试次数等高级配置（默认不实现）。
- LWW 为整条条目覆盖（不做字段级保留），**唯一例外是 `storage` 字段会在覆盖时被保留**（承载本地信息，不由外部系统回填）。

---
关联：`docs/design.md`（方向层数据策略），`RFC-001-kind-providers.md`（Kind 最小字段与示例）。

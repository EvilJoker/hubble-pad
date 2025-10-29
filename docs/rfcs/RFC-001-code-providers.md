# RFC-001: Code Providers 集成（GitHub/GitLab/Gitea）

状态：Provisional | 所属层：方案层 | 变更范围：`WorkItem(kind=code)`

## 背景与问题
- 聚焦首期：代码托管平台的“我的代码动态”与快捷入口。

## 目标与非目标（与 design.md 对齐）
- 目标：统一映射为 `WorkItem(kind=code)` 的最小字段；点击直达平台。
- 非目标：不展示 diff/评论、不做增删改查、不复制平台功能。

## 方案概览（待细化）
- 数据来源：GitHub / GitLab / Gitea（按配置启用）。
- 摘要内容：我的 PR/MR、最近提交、活动计数（24/72h）。
- 降级策略：请求失败时仅保留平台入口链接。

## 契约影响（草案）
- 统一最小字段（已对齐方向层）：`id`, `title`, `describe`, `url`。
- 可选扩展：`attributes` 挂载平台特有信息（如 repo/branch、author、state、updatedAt）。

## JSON Schema（指向）
- 统一/权威 Schema 文件：`docs/schemas/workitem.schema.json`

## GitHub 钩子输出示例（仅仓库入口，草案）
```
[
  {
    "id": "repo_org_repo1",
    "title": "repo1",
    "description": "Core services",
    "url": "https://github.com/org/repo1",
    "kind": "code",
    "attributes": {
      "provider": "github",
      "repo": "org/repo1",
      "defaultBranch": "main",
      "visibility": "private",
      "updatedAt": "2025-10-29T10:00:00Z"
    }
  },
  {
    "id": "repo_org_repo2",
    "title": "repo2",
    "description": "UI components",
    "url": "https://github.com/org/repo2",
    "kind": "code",
    "attributes": {
      "provider": "github",
      "repo": "org/repo2",
      "defaultBranch": "develop",
      "visibility": "public",
      "updatedAt": "2025-10-28T08:30:00Z"
    }
  }
]
```

## 字段映射（GitHub Repository → WorkItem，草案）
- Repository:
  - id: `"repo_" + owner + "_" + name`
  - title: `name`
  - description: `description`
  - url: `html_url`
  - kind: `code`
  - attributes: `{ provider:"github", repo:"owner/name", defaultBranch: default_branch, visibility, updatedAt: updated_at }`

说明：本阶段仅输出仓库入口列表，不包含 PR/MR/提交等活动数据。

## 风险与回滚
- 配额/速率限制；凭证失效；单源失败不影响整体（降级）。

## 待确认
- 平台优先顺序与必要字段清单。
- 认证方式（Token/代理/内网）。
- 刷新与缓存策略。

---
关联：`design.md`（方向层结论与承诺）。

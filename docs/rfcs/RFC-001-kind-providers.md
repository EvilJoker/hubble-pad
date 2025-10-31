# RFC-001: Kind Providers（code/task/environment）

状态：Provisional | 所属层：方案层 | 变更范围：`WorkItem(kind=*)`

## 背景与问题
- 首期不仅关注代码入口（code），也会逐步纳入任务（task）与环境（environment）等入口。
- 需要一个统一、最小的 WorkItem 契约，允许不同 kind 的条目并列展示，并便于过滤。

## 目标与非目标
- 目标：
  - 统一映射为 `WorkItem` 最小字段集：`id`、`title`、`description`、`url`、`kind?`、`attributes?`。
  - 通过前端以 URL Query `?kind=` 进行筛选展示；不改写数据文件。
  - 支持三种首批 kind：`code` | `task` | `environment`。
- 非目标：
  - 不做平台功能复制（如 PR 审阅、流水线详情等）。
  - 不引入后端存储或额外聚合层；继续使用单文件事实源 `data/workitems.json`。

## 最小数据结构
- 公共 WorkItem（最小字段，所有 kind 通用）
```
type WorkItem = {
  id: string
  title: string
  description: string
  url: string
  kind?: 'code' | 'task' | 'environment'
  attributes?: Record<string, any>
}
```

- code（示例扩展属性）
```
attributes: {
  provider?: 'github' | 'gitlab' | 'gitea',
  repo?: string,                // 例："org/repo"
  defaultBranch?: string,
  visibility?: 'public' | 'private',
  updatedAt?: string            // ISO 时间
}
```

- task（示例扩展属性）
```
attributes: {
  provider?: 'jira' | 'linear' | 'tapd',
  project?: string,
  status?: string,              // 例："todo" | "doing" | "done"
  assignee?: string,
  updatedAt?: string
}
```

- environment（示例扩展属性）
```
attributes: {
  provider?: 'k8s' | 'argocd' | 'helm',
  cluster?: string,
  namespace?: string,
  app?: string,
  status?: string,              // 例："healthy" | "degraded"
  updatedAt?: string
}
```

说明：`kind` 为可选展示字段；缺失 `kind` 的条目仅在“全部”视图展示。

## JSON Schema（指向）
- 权威 Schema 文件：`docs/schemas/workitem.schema.json`
  - 必填：`id`、`title`、`description`、`url`
  - 可选：`kind`、`attributes`

## 输出与采集
- 钩子脚本统一输出响应对象：`{ ok: boolean, items: WorkItem[], error?: string }`
- 采集来源可包含（不限于）：
  - code：GitHub / GitLab / Gitea 仓库入口
  - task：Jira / Linear / TAPD 问题或任务入口
  - environment：K8s/ArgoCD/Helm 环境或应用入口

## 示例（混合列表）
```
{
  "ok": true,
  "items": [
    { "id": "repo_org_repo1", "title": "repo1", "description": "Core", "url": "https://github.com/org/repo1", "kind": "code", "attributes": { "provider": "github", "repo": "org/repo1", "defaultBranch": "main", "visibility": "private", "updatedAt": "2025-10-29T10:00:00Z" } },
    { "id": "jira_proj_123", "title": "JIRA-123 修复", "description": "修复登录异常", "url": "https://jira.example/browse/JIRA-123", "kind": "task", "attributes": { "provider": "jira", "project": "JIRA", "status": "doing", "assignee": "alice", "updatedAt": "2025-10-30T12:00:00Z" } },
    { "id": "k8s_ns_app", "title": "prod/app", "description": "生产环境应用", "url": "https://argocd.example/app/prod/app", "kind": "environment", "attributes": { "provider": "argocd", "cluster": "prod", "namespace": "app", "app": "app", "status": "healthy", "updatedAt": "2025-10-30T09:30:00Z" } }
  ]
}
```

## 风险与降级
- 字段差异：仅保证最小字段一致；差异信息放入 `attributes`，前端仅做轻展示。
- 来源失败：按钩子契约 `ok=false` + `error` 降级，不影响其他来源。

## 待确认
- 三类 kind 的扩展字段清单是否需要进一步标准化（当前建议保持宽松）。

---
关联：`design.md`（方向层结论与承诺），`RFC-002-data-hooks.md`（钩子输出与合并）。

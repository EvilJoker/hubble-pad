# Roadmap v1.0.0

- 目标: 交付最小可用工作台（kind=code 仓库入口，摘要+跳转）
- 时间线: M1(Week1-2) / M2(Week3-4) / M3(Week5-6)

## 里程碑
- M1: 前端骨架、读取 /data/workitems.json、搜索与排序、空态与错误文案
- M2: GitHub 钩子脚本、并发写入策略(最后写入者覆盖)、可选自动感知重载、收藏
- M3: 多 kind 演练(environment 占位)、渲染器注册表、文档与 RFC 完整化

## 待办清单
- [x] Vue + Tailwind CSS + shadcn + 集成图标（Uno Icons，lucide 源）+ 页面骨架
- [x] 列表渲染与本地过滤/排序
- [x] 开发环境 /data 映射 与 /__data/save 写入
- [x] 编辑数据弹窗（全量/条目级）+ 本地 JSON 校验与错误提示
- [ ] GitHub 钩子脚本输出统一 JSON
- [ ] 写入日志与失败回滚策略
- [ ] kind 渲染兜底与注册表

## 风险与应对
- 字段扩散 → 保持最小字段( id/title/description/url )，差异入 attributes
- 写入冲突 → 默认最后写入覆盖 + 时间戳日志；必要时引入单聚合钩子
- 渲染不一致 → 未注册 kind 使用默认渲染(仅最小字段)

## 变更记录
- 2025-10-29: 初始版本
- 2025-10-30: 前端技术栈调整为 Vue + Tailwind CSS + shadcn-vue；后续任务按新栈实施。
- 2025-10-30: 完成 M1 UI 能力（页面骨架、搜索/排序、空态/错误）；集成 Tooltip；新增“编辑数据”弹窗与条目级编辑，保存走 dev 中间件。

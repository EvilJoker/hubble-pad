# Hubble Pad npm 发布策略与流程

## 概述

本文档描述 Hubble Pad 项目从 GitHub 到 npm 的完整发布流程，包括版本管理、自动化构建和发布策略。

## 核心策略

### 发布方案
- **方案类型**：只发布构建产物（dist/），不包含源码
- **包含内容**：
  - `dist/` - 前端构建产物（静态文件）
  - `server/` - Express HTTP 服务器（提供静态文件服务）
  - `bin/` - CLI 命令行工具
- **用户使用方式**：`npm install -g hubble-pad` → `hubble-pad start`

### 版本策略

#### 版本号规则
遵循语义化版本（SemVer）：`主版本号.次版本号.修订号`

#### 两种发布模式

**1. Beta 版本（开发版本）**
- **触发条件**：推送代码到 `main` 分支（也支持 `master` 分支）
- **版本号格式**：`<当前主版本>-snapshot.<YYYYMMDD>.<commit-hash>`
- **示例**：
  - `1.0.0-snapshot.20241220.a1b2c3d`（使用 Git commit SHA 短哈希）
  - `1.0.0-snapshot.20241220.e4f5g6h7`（不同 commit 的哈希）
  - `1.0.0-snapshot.20241221.i8j9k0l1`（新的一天，新的 commit）
- **用途**：用于持续集成测试、开发验证
- **发布位置**：npm（使用 `beta` tag，用户可通过 `npm install hubble-pad@beta` 或指定完整版本号安装）

**2. 正式版本（Release 版本）**
- **触发条件**：在 `main` 分支（或 `master` 分支）打 tag（格式：`v*`）
- **版本号格式**：`主版本号.次版本号.修订号`
- **示例**：
  - `v1.0.0` → 发布 `1.0.0`
  - `v1.0.1` → 发布 `1.0.1`
  - `v1.1.0` → 发布 `1.1.0`
  - `v2.0.0` → 发布 `2.0.0`
- **用途**：正式发布，用户可通过 `npm install -g hubble-pad` 安装最新正式版
- **发布位置**：npm（作为 latest 版本）

---

## 项目结构调整

### 当前结构
```
hubble-pad/
├── web/              # 前端源码
│   ├── src/
│   ├── package.json
│   └── dist/         # 构建产物（开发时生成）
├── data/             # 数据文件（不发布）
└── docs/             # 文档（可选发布）
```

### 调整后结构（修改源码仓库）

**说明**：以下文件和目录将在源码仓库中实际创建，而不是仅在发布时临时创建。

```
hubble-pad/
├── package.json      # 根配置（新增，实际文件）
├── bin/              # CLI 目录（新增，实际目录）
│   └── cli.js        # CLI 入口（新增，实际文件）
├── server/           # 服务器目录（新增，实际目录）
│   └── index.js      # Express 服务器（新增，实际文件）
├── dist/             # 构建产物目录（新增，构建时生成）
├── web/              # 前端源码（保持不变）
│   ├── src/
│   ├── package.json
│   └── dist/         # 构建产物（构建后复制到根目录 dist/）
├── data/             # 数据文件（保持不变，不发布）
├── docs/             # 文档（保持不变，可选发布）
├── .github/          # GitHub 配置（新增）
│   └── workflows/
│       └── release.yml    # GitHub Actions 配置（新增）
├── .npmignore        # 控制发布内容（新增）
└── README.md         # 使用说明（已存在，发布时包含）
```

### 关键变化说明

1. **根目录 package.json**：
   - 管理整个项目的版本和发布配置
   - 包含构建脚本和 CLI 配置
   - 是发布的入口 package.json

2. **bin/cli.js**：
   - CLI 命令行工具的入口文件
   - 支持 `hubble-pad start` 和 `hubble-pad --version` 命令

3. **server/index.js**：
   - Express HTTP 服务器
   - 提供静态文件服务（服务 `dist/` 目录）

4. **dist/ 目录**：
   - 构建时，将 `web/dist/` 的内容复制到根目录 `dist/`
   - 这个目录会被发布到 npm

---

## 工作流程

### 日常开发流程

**步骤 1：本地开发**
```bash
# 方式 A：在前端目录开发（推荐用于前端开发）
cd web/
npm run dev          # 开发模式

# 方式 B：在根目录开发（推荐用于整体测试）
npm run dev          # 如果配置了根目录的 dev 脚本
```

**步骤 2：本地构建和测试**

**方式 A：使用一键安装脚本（推荐）**
```bash
# 在根目录执行，一键完成构建、打包、安装
npm run install:local
hubble-pad start      # 测试运行
hubble-pad --version  # 测试版本命令
```

**方式 B：手动执行各步骤**
```bash
# 在根目录执行
npm run build         # 构建并复制产物
npm pack              # 打包成 .tgz 文件
npm install -g ./hubble-pad-1.0.0.tgz  # 本地安装
hubble-pad start      # 测试运行
hubble-pad --version  # 测试版本命令
```

**步骤 3：提交代码**
```bash
# 在根目录
git add .
git commit -m "feat: 新功能描述"
git push origin main
```

**步骤 4：自动触发（GitHub Actions）**
- 检测到 `main` 分支（或 `master` 分支）有推送
- 自动触发构建流程
- 生成 beta 版本号（如 `1.0.0-snapshot.20241220.a1b2c3d`，使用 Git commit SHA）
- 安装依赖（在 `web/` 目录）
- 构建 `web/` → 生成 `web/dist/`
- 复制 `web/dist/` → 根目录 `dist/`
- 更新根目录 `package.json` 的版本号为生成的 beta 版本号
- 发布到 npm（beta 版本，使用 `beta` tag，包含 `dist/`, `server/`, `bin/`）

### 正式版本发布流程

**步骤 1：准备发布**
```bash
# 确保代码已提交并推送到 main
git add .
git commit -m "chore: 准备发布 v1.0.0"
git push origin main
```

**步骤 2：打 Tag 触发发布**
```bash
# 打 tag（版本号从 tag 中提取）
git tag v1.0.0
git push --tags
```

**步骤 3：自动触发（GitHub Actions）**
- 检测到 tag 推送（格式 `v*`）
- 从 tag 提取版本号（如 `v1.0.0` → `1.0.0`）
- 安装依赖（在 `web/` 目录）
- 构建 `web/` → 生成 `web/dist/`
- 复制 `web/dist/` → 根目录 `dist/`
- **将提取的版本号写入根目录 `package.json` 的 `version` 字段**
- 发布到 npm（正式版本，标记为 latest，包含 `dist/`, `server/`, `bin/`）

**步骤 4：验证发布**
```bash
# 等待几分钟后验证
npm view hubble-pad versions  # 查看所有版本
npm view hubble-pad version   # 查看最新版本
npm install -g hubble-pad     # 测试安装最新正式版
hubble-pad --version           # 验证版本
```

---

## 版本号生成规则

### Beta 版本号生成逻辑

**格式**：`<基准版本>-snapshot.<日期>.<commit-hash>`

**规则**：
1. **基准版本**：从 `package.json` 的 `version` 字段读取（如 `1.0.0`）
2. **日期**：构建时的日期，格式 `YYYYMMDD`（如 `20241220`）
3. **Commit Hash**：使用 Git commit SHA 的短哈希（7 位字符），确保唯一性
   - 获取方式：`git rev-parse --short=7 HEAD`
   - 示例：`.a1b2c3d`

**示例场景**：

| 时间 | 操作 | Commit Hash | 生成的版本号 | 说明 |
|------|------|------------|------------|------|
| 2024-12-20 10:00 | 推送代码到 main | `a1b2c3d` | `1.0.0-snapshot.20241220.a1b2c3d` | commit a1b2c3d |
| 2024-12-20 14:00 | 再次推送 | `e4f5g6h` | `1.0.0-snapshot.20241220.e4f5g6h` | commit e4f5g6h |
| 2024-12-20 16:00 | 再次推送 | `i8j9k0l` | `1.0.0-snapshot.20241220.i8j9k0l` | commit i8j9k0l |
| 2024-12-21 09:00 | 新一天推送 | `m1n2o3p` | `1.0.0-snapshot.20241221.m1n2o3p` | 新的一天 |

**技术实现要点**：
- 使用 Git commit SHA 短哈希（7 位）作为版本号的一部分
- 每次推送都有唯一的 commit，天然保证版本号唯一性
- 方便追溯到具体的代码版本
- 实现命令：`git rev-parse --short=7 HEAD`

### 正式版本号生成规则

**从 Git Tag 提取并写入 package.json**：
- Tag 格式：`v1.0.0`, `v1.0.1`, `v1.1.0`
- 提取规则：去除 `v` 前缀，使用剩余部分作为版本号（如 `v1.0.0` → `1.0.0`）
- 验证：确保符合 SemVer 格式
- **更新策略**：将提取的版本号写入根目录 `package.json` 的 `version` 字段（覆盖原有版本号）

---

## GitHub Actions 工作流设计

### 工作流文件：`.github/workflows/release.yml`

#### 触发条件

**两种触发方式**：

1. **Push 到 main/master**（Snapshot 版本）
   ```yaml
   on:
     push:
       branches:
         - main
         - master
       tags:
         - 'v*'
   ```

2. **Push Tag**（正式版本）
   ```yaml
   on:
     push:
       tags:
         - 'v*'  # 匹配 v1.0.0, v1.1.0 等
   ```

#### 工作流步骤（Beta）

1. **检出代码**
2. **设置 Node.js 环境**
   - 使用 Node.js 20（Vite 7 要求 Node.js 20.19+ 或 22.12+）
3. **安装依赖**
   - 在 `web/` 目录运行 `npm ci`（使用锁定文件，确保依赖版本一致）
4. **构建项目**
   - 在 `web/` 目录运行 `npm run build`
   - 生成 `web/dist/`
5. **复制构建产物**
   - 复制 `web/dist/` 的所有内容 → 根目录 `dist/`
   - 命令：`rm -rf dist && cp -r web/dist dist`
6. **生成 Beta 版本号**
   - 读取根目录 `package.json` 的 `version` 字段（如 `1.0.0`）
   - 获取当前日期（YYYYMMDD，如 `20241220`）：`date +%Y%m%d`
   - 获取 Git commit 短哈希（7 位）：`git rev-parse --short=7 HEAD`
   - 组合版本号：`1.0.0-snapshot.20241220.a1b2c3d`
7. **更新版本号**
   - 更新根目录 `package.json` 的 `version` 字段为生成的 beta 版本号
8. **发布到 npm**
   - 设置 npm 认证（使用 NPM_TOKEN secret）
   - 在根目录运行 `npm publish --tag beta`（使用 beta tag，不影响 latest）
   - 发布内容：`dist/`, `server/`, `bin/`, `package.json`, `README.md`（由 `files` 字段控制）

#### 工作流步骤（正式版本）

1. **检出代码**
2. **设置 Node.js 环境**
   - 使用 Node.js 20（Vite 7 要求 Node.js 20.19+ 或 22.12+）
3. **提取版本号**
   - 从 tag 名称提取（`v1.0.0` → `1.0.0`）
   - 验证版本号格式（确保符合 SemVer）
4. **安装依赖**
   - 在 `web/` 目录运行 `npm ci`（使用锁定文件，确保依赖版本一致）
5. **构建项目**
   - 在 `web/` 目录运行 `npm run build`
   - 生成 `web/dist/`
6. **复制构建产物**
   - 复制 `web/dist/` 的所有内容 → 根目录 `dist/`
   - 命令：`rm -rf dist && cp -r web/dist dist`
7. **更新版本号**
   - 将提取的版本号写入根目录 `package.json` 的 `version` 字段（如 `1.0.0`）
   - 覆盖原有版本号
8. **发布到 npm**
   - 设置 npm 认证（使用 NPM_TOKEN secret）
   - 在根目录运行 `npm publish`（默认发布为 latest 版本）
   - 发布内容：`dist/`, `server/`, `bin/`, `package.json`, `README.md`（由 `files` 字段控制）

---

## 包配置设计

### 根目录 package.json 结构

**关键字段**：

- `name`: `hubble-pad`（或 `@scope/hubble-pad`）
- `version`: 动态更新（构建时由 GitHub Actions 设置）
- `main`: 指向 server 入口（可选）
- `bin`: CLI 命令配置
  ```json
  "bin": {
    "hubble-pad": "./bin/cli.js"
  }
  ```
- `files`: 控制发布内容
  ```json
  "files": [
    "dist",
    "server",
    "bin",
    "README.md"
  ]
  ```
- `dependencies`: Server 依赖（Express 等）
  ```json
  "dependencies": {
    "express": "^4.18.2"
  }
  ```
- `engines`: Node.js 版本要求
  ```json
  "engines": {
    "node": ">=20.0.0"
  }
  ```
- `scripts`: 构建和发布脚本
- `publishConfig`: npm 发布配置

### .npmignore 配置

**排除内容**：
- `web/`（源码，不发布）
- `web/dist/`（构建产物在 web/ 目录，不需要）
- `data/`（数据文件，不发布）
- `docs/`（文档，可选，建议不发布）
- `.git/`
- `.github/`（GitHub 配置，不发布）
- `node_modules/`
- `*.log`
- `.npmignore`（本身不需要发布）
- 开发配置文件（如 `.vscode/`, `.idea/` 等）

**注意**：`files` 字段优先级高于 `.npmignore`，如果配置了 `files`，则只发布 `files` 中列出的内容。

---

## .gitignore 配置

### 需要忽略的文件和目录

在根目录创建或更新 `.gitignore` 文件：

```
# 构建产物
dist/
web/dist/

# npm 包
*.tgz
*.tar.gz

# 依赖
node_modules/

# 环境变量
.env
.env.local

# 日志
*.log
logs/

# 系统文件
.DS_Store
Thumbs.db

# IDE 配置
.vscode/
.idea/
*.swp
*.swo

# 临时文件
*.tmp
.cache/
```

**说明**：
- `dist/` 和 `web/dist/` 都是构建产物，不应提交到仓库
- `*.tgz` 是本地打包测试生成的临时文件
- 其他为常见的忽略规则

---

## 本地开发与测试

### 本地构建脚本

在根目录 `package.json` 中配置：

```json
{
  "scripts": {
    "build:web": "cd web && npm run build",
    "build:copy": "rm -rf dist && cp -r web/dist dist",
    "build": "npm run build:web && npm run build:copy",
    "dev": "cd web && npm run dev",
    "prepack": "npm run build",
    "pack": "npm pack"
  }
}
```

**构建脚本逻辑**：
1. `build:web`：在 `web/` 目录构建，生成 `web/dist/`
2. `build:copy`：删除旧的 `dist/` 目录，将 `web/dist/` 的内容复制到根目录 `dist/`
   - 使用 Linux 命令：`rm -rf dist && cp -r web/dist dist`
3. `build`：顺序执行 `build:web` 和 `build:copy`（完整构建流程）
4. `prepack`：在 `npm pack` 之前自动执行 `build`，确保构建产物最新

### 本地测试流程

1. **安装依赖**（首次）：
   ```bash
   cd web
   npm install
   cd ..
   ```

2. **构建**：
   ```bash
   # 在根目录
   npm run build
   # 这会：构建 web/ → 生成 web/dist/ → 复制到根目录 dist/
   ```

3. **打包**：
   ```bash
   npm pack
   # 会自动执行 prepack 脚本（确保构建最新）
   # 生成 hubble-pad-1.0.0.tgz
   ```

4. **安装测试**：
   ```bash
   npm install -g ./hubble-pad-1.0.0.tgz
   ```

5. **运行测试**：
   ```bash
   hubble-pad start      # 启动服务器，测试是否正常
   hubble-pad --version  # 测试版本命令
   ```

---

## CLI 设计

### 支持的命令

**`hubble-pad start`**
- 功能：启动 Express 服务器
- 默认端口：8000（可通过环境变量 `PORT` 配置）
- 服务内容：提供 `dist/` 目录的静态文件

**`hubble-pad --version`** 或 **`hubble-pad -v`**
- 功能：显示版本号
- 输出：从 `package.json` 读取并显示

### CLI 入口文件：`bin/cli.js`

**功能**：
- 解析命令行参数
- 执行对应命令
- 错误处理

**路径处理**：
- 使用 `__dirname` 获取脚本所在目录
- 使用 `path.resolve(__dirname, '../package.json')` 获取 `package.json` 路径（用于读取版本号）
- 使用 `path.resolve(__dirname, '../dist')` 获取 `dist/` 目录路径（传递给 server）
- 确保在不同安装位置（全局/本地）都能正确找到文件

---

## Server 设计

### server/index.js

**功能**：
- 使用 Express 创建 HTTP 服务器
- 提供静态文件服务（服务 `dist/` 目录）
- 配置端口（环境变量或默认 8000）
- 支持 SPA 路由（所有路由返回 index.html）

**路径处理**：
- 使用 `__dirname` 获取脚本所在目录
- 使用 `path.resolve(__dirname, '../dist')` 获取 `dist/` 目录的绝对路径
- 使用 `express.static()` 提供静态文件服务，确保在不同安装位置都能正确找到文件

**要求**：
- 轻量级，只提供静态文件服务
- 支持配置端口（通过环境变量 `PORT`，默认 8000）
- 提供友好的启动日志（显示端口和 dist 目录路径）

---

## npm 发布配置

### 需要的 npm 配置

1. **npm 账号**
   - 注册 npm 账号（如果没有）
   - 获取访问 token

2. **GitHub Secrets 配置**
   - `NPM_TOKEN`: npm 访问 token
   - 用于 GitHub Actions 自动发布

3. **包名检查**
   - 确认 `hubble-pad` 在 npm 上可用
   - 如果不可用，考虑使用 scope（如 `@your-username/hubble-pad`）

---

## 版本管理最佳实践

### 版本号更新规则

- **主版本号（Major）**：重大变更，不向后兼容
- **次版本号（Minor）**：新功能，向后兼容
- **修订号（Patch）**：Bug 修复，向后兼容

### 版本发布建议

- **Beta 版本**：每次推送都自动发布，用于持续验证
- **正式版本**：功能稳定、测试通过后发布（初始版本 `v1.0.0`，小功能 `v1.1.0`，Bug 修复 `v1.0.1`，重大变更 `v2.0.0`）

---

## 用户使用方式

### 安装正式版本

```bash
# 全局安装最新正式版
npm install -g hubble-pad

# 使用
hubble-pad start
hubble-pad --version
```

### 安装 Beta 版本（测试）

```bash
# 安装最新 beta 版本
npm install -g hubble-pad@beta

# 或安装特定 beta 版本
npm install -g hubble-pad@1.0.0-snapshot.20241220.a1b2c3d
```

### 本地安装（开发）

```bash
# 克隆仓库
git clone https://github.com/your-username/hubble-pad.git
cd hubble-pad

# 安装依赖
cd web && npm install && cd ..

# 开发模式（前端开发）
cd web && npm run dev

# 或使用根目录脚本（如果配置了）
npm run dev

# 构建（在根目录）
npm run build
# 这会构建 web/ 并复制产物到根目录 dist/

# 全局安装命令（一键构建+打包+安装）
npm run install:local
# 这会自动执行：构建 → 打包 → 全局安装 → 清理临时文件

# 本地测试运行（构建后）
node server/index.js
# 或使用 CLI（如果已安装）
hubble-pad start
```

---

## 注意事项

### 发布前检查清单

- [ ] 代码已提交到 main（或 master）
- [ ] Node.js 版本 >= 20.0.0（用于本地构建测试）
- [ ] 构建成功（本地测试）
- [ ] 版本号正确（正式版本从 tag 提取，GitHub Actions 会自动写入 package.json）
- [ ] `.npmignore` 配置正确
- [ ] `files` 字段包含必要文件
- [ ] README.md 已更新

### 常见问题

1. **版本冲突**：使用 commit hash 作为版本号的一部分，天然保证唯一性，不会冲突
2. **发布失败**：检查 NPM_TOKEN 是否正确配置
3. **构建失败**：检查 GitHub Actions 日志，排查依赖问题

---

## 后续优化（可选）

1. **自动化 Changelog**：根据 commit message 自动生成
2. **通知机制**：发布成功后发送通知（如 Slack、邮件）
3. **回滚机制**：支持撤销发布（npm unpublish）
4. **版本标签管理**：在 npm 上管理 beta 和 latest 标签

**注意**：
- 不发布到 GitHub Packages（已使用 npm 发布）
- 不自动创建 GitHub Release（保持简单，只发布到 npm）

---

## 总结

**核心流程**：
1. 开发 → 推送 main → 自动发布 beta 版本（使用 commit hash）
2. 准备发布 → 打 tag → 自动发布正式版本（从 tag 提取版本号）

**关键点**：
- Beta 版本：`<version>-snapshot.<日期>.<commit-hash>`，使用 `beta` tag
- 正式版本：从 Git tag 提取并写入 `package.json`，使用 `latest` tag
- 只发布构建产物，不包含源码
- 全自动化，无需手动发布

**优势**：
- 简化发布流程
- 持续集成，每次推送都有可测试版本
- 版本管理清晰，beta 和正式版本分离
- 使用 commit hash 确保版本号唯一性，便于追溯代码版本

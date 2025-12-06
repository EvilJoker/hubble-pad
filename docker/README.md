# Docker 容器化配置

## 文件说明

- **Dockerfile**: 多阶段构建配置，用于构建生产镜像
- **docker-compose.yml**: Docker Compose 配置文件，用于管理容器生命周期

## 快速开始

### 使用脚本（推荐）

```bash
# 启动容器（开发模式，使用 data 目录）
./run.sh

# 启动容器（生产模式，使用 data_local 目录）
./run.sh prod

# 停止容器
./stop.sh
```

### 手动操作

```bash
# 构建并启动
cd docker
docker-compose up -d --build

# 查看日志
docker logs -f hubble-pad

# 停止
docker-compose down
```

## 配置说明

### 端口

- 默认端口: `10002`
- 可通过环境变量 `PORT` 修改

### 数据目录

容器同时挂载两个数据目录，通过 `run.sh` 参数或环境变量控制使用哪个：

- **开发模式**（默认）:
  - 容器内路径: `/app/data`
  - 挂载点: `../data` (项目根目录下的 data 目录)
  - 启动方式: `./run.sh` 或 `./run.sh dev`

- **生产模式**:
  - 容器内路径: `/app/data_local`
  - 挂载点: `../data_local` (项目根目录下的 data_local 目录)
  - 启动方式: `./run.sh prod`

- 可通过环境变量 `HUBBLE_PAD_DATA_DIR` 手动指定其他路径

### 环境变量

- `PORT`: 服务端口（默认: 10002）
- `HUBBLE_PAD_DATA_DIR`: 数据目录路径（默认: /app/data）
- `NODE_ENV`: 运行环境（默认: production）
- `NPM_REGISTRY`: npm 镜像源（默认: https://registry.npmmirror.com）
- `NPM_PROXY` / `NPM_HTTPS_PROXY`: npm 代理（可选，默认继承 http_proxy/https_proxy）

### Python 依赖

容器内已安装 Python 3 和 pip，Python 依赖通过 `docker/requirements.txt` 管理：

- 文件位置: `docker/requirements.txt`
- 安装时机: 容器构建时自动安装
- 添加依赖: 编辑 `docker/requirements.txt`，然后重新构建镜像

当前包含的依赖：
- `requests`: HTTP 请求库（用于 RDC、Redmine 等 API 调用）

## 构建说明

### 多阶段构建

1. **构建阶段 (builder)**:
   - 安装所有依赖（包括 devDependencies）
   - 构建前端（Vue 应用）
   - 输出: `dist/` 目录

2. **运行阶段 (runner)**:
   - 只安装生产依赖
   - 复制构建产物和服务器代码
   - 默认以 root 运行（便于直接写入挂载的数据目录，如需非 root 可自行调整）
   - 最终镜像大小优化

### 健康检查

容器包含健康检查配置，检查 `/api/config` 端点：
- 检查间隔: 30秒
- 超时时间: 3秒
- 启动等待: 5秒
- 重试次数: 3次

## 数据持久化

数据目录通过 Volume 挂载，确保数据在容器重启后不丢失：

```yaml
volumes:
  - ../data:/app/data          # 开发/演示数据
  - ../data_local:/app/data_local  # 生产数据
```

**数据目录选择**：
- 使用 `./run.sh`（不带参数）时，服务使用 `/app/data`（对应宿主机的 `data` 目录）
- 使用 `./run.sh prod` 时，服务使用 `/app/data_local`（对应宿主机的 `data_local` 目录）

**包含的文件**：
- `workitems.json`: 工作项数据
- `hooks.json`: 任务配置
- `kind.json`: 类型定义
- `notify.json`: 提醒数据
- `hook/`: Hook 脚本目录
- `logs/`: 日志目录
- `status.json`: 服务状态信息（自动生成，已加入 .gitignore）

## 故障排查

### 查看日志

```bash
docker logs hubble-pad
docker logs -f hubble-pad  # 实时日志
```

### 进入容器

```bash
docker exec -it hubble-pad sh
```

### 检查健康状态

```bash
docker ps  # 查看容器状态
docker inspect hubble-pad | grep Health -A 10
```

### npm 拉取失败（网络/镜像源问题）

- 构建时可通过环境变量切换镜像源或代理：
  ```bash
  export NPM_REGISTRY=https://registry.npmmirror.com
  export NPM_PROXY=http://your-proxy:port
  export NPM_HTTPS_PROXY=http://your-proxy:port
  ./run.sh
  ```
- 若内网镜像不支持 npm audit，可忽略日志中的 audit 404 警告。
- 代理配置会优先使用环境变量 `NPM_PROXY`/`NPM_HTTPS_PROXY`，其次使用 `http_proxy`/`https_proxy`，最后为空（不使用代理）。

### 数据目录权限

- 当前镜像默认 root 运行，挂载宿主机 `data` 目录不会有写权限问题。
- 如需非 root 运行，可自行在 Dockerfile/compose 中增加 `user` 或创建匹配宿主机 UID/GID 的用户。


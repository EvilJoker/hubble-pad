#!/bin/bash

# Hubble Pad 容器启动脚本
# 用法: ./run.sh [prod]
#   - 不带参数: 使用 data 目录（开发/演示环境）
#   - prod: 使用 data_local 目录（生产环境）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/docker"

# 检查参数
MODE="${1:-dev}"
if [ "$MODE" = "prod" ]; then
  DATA_DIR="/app/data_local"
  echo "🚀 启动 Hubble Pad 容器（生产模式，使用 data_local）..."
else
  DATA_DIR="/app/data"
  echo "🚀 启动 Hubble Pad 容器（开发模式，使用 data）..."
fi

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ 错误: Docker 未运行，请先启动 Docker"
    exit 1
fi

# 检查 docker-compose 是否可用
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo "❌ 错误: 未找到 docker-compose 或 docker compose 命令"
    exit 1
fi

# 切换到 docker 目录
cd "${DOCKER_DIR}"

# 设置数据目录环境变量并构建启动容器
export HUBBLE_PAD_DATA_DIR="${DATA_DIR}"
${COMPOSE_CMD} up -d --build

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 3

# 检查容器状态
if docker ps | grep -q hubble-pad; then
    echo "✅ Hubble Pad 容器已启动"
    echo "📊 容器状态:"
    docker ps | grep hubble-pad
    echo ""
    echo "🌐 服务地址: http://localhost:10002"
    echo "📁 数据目录: ${DATA_DIR}"
    echo "📝 查看日志: docker logs -f hubble-pad"
    echo "🛑 停止服务: ./stop.sh"
else
    echo "❌ 容器启动失败，请查看日志:"
    docker logs hubble-pad
    exit 1
fi


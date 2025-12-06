#!/bin/bash

# Hubble Pad 容器停止脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/docker"

echo "🛑 停止 Hubble Pad 容器..."

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

# 停止并删除容器
${COMPOSE_CMD} down

# 检查是否还有容器运行
if docker ps -a | grep -q hubble-pad; then
    echo "⚠️  发现残留容器，正在清理..."
    docker rm -f hubble-pad 2>/dev/null || true
fi

echo "✅ Hubble Pad 容器已停止"


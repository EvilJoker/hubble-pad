#!/usr/bin/env bash
set -e
sleep 10
echo "开始拉取 GitHub 仓库信息..."
echo "模拟失败场景..."
echo "response={\"ok\": false, \"error\": \"模拟失败: 拉取仓库出错\", \"items\": []}"
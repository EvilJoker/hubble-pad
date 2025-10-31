#!/usr/bin/env bash
set -e
sleep 10
cat <<'JSON'
{ "ok": false, "error": "模拟失败: 拉取仓库出错", "items": [] }
JSON
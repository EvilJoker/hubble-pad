#!/usr/bin/env bash
set -e
sleep 10
cat <<'JSON'
{ "ok": true, "items": [
  {"id": "repo1", "title": "repo1", "description": "核心服务", "url": "https://example.com/repo1", "kind": "code"},
  {"id": "repo2", "title": "repo2", "description": "组件库", "url": "https://example.com/repo2", "kind": "code"}
]}
JSON

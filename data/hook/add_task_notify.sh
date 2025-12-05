#!/usr/bin/env bash

set -euo pipefail

# 基础 API 地址：
# - 优先使用环境变量 HUBBLE_PAD_API_URL
# - 未设置时，优先尝试 Vite dev 默认端口 10002，其次退回后端默认端口 8000
API_BASE="${HUBBLE_PAD_API_URL:-http://127.0.0.1:10002}"
ALT_API_BASE="http://127.0.0.1:8000"

# 检测可用的 API 地址
detect_api_base() {
  if curl -fsS "${API_BASE}/api/config" >/dev/null 2>&1; then
    echo "${API_BASE}"
    return 0
  fi
  if curl -fsS "${ALT_API_BASE}/api/config" >/dev/null 2>&1; then
    echo "${ALT_API_BASE}"
    return 0
  fi
  echo "Error: Cannot reach API server at ${API_BASE} or ${ALT_API_BASE}" >&2
  return 1
}

# 确定实际使用的 API 地址
ACTUAL_API_BASE="$(detect_api_base)" || exit 1

get_json() {
  local path="$1"
  curl -fsS "${ACTUAL_API_BASE}${path}" 2>/dev/null || return 1
}

post_json() {
  local path="$1"
  local data="$2"
  local response
  response="$(curl -fsS -X POST "${ACTUAL_API_BASE}${path}" \
    -H 'Content-Type: application/json' \
    -d "${data}" 2>&1)"
  if [ $? -eq 0 ]; then
    # 检查响应是否为 {"ok":true}
    if echo "${response}" | jq -e '.ok == true' >/dev/null 2>&1; then
      return 0
    fi
  fi
  # 如果失败，输出错误信息到 stderr（不影响 hooks 协议输出）
  echo "Warning: Failed to POST to ${ACTUAL_API_BASE}${path}" >&2
  echo "Response: ${response}" >&2
  return 1
}

# 读取当前 workitems（只关心 kind === "task" 的工作项）
workitems_json="$(get_json "/data/workitems.json" || echo '[]')"

# 使用 jq 生成需要添加的提醒项（每个 task 类型的 workitem 一条提醒）
echo "${workitems_json}" | jq -c '
  .[] | select(.kind == "task") |
  {
    workitemId: .id,
    title: ("任务提醒：" + (.title // .id)),
    content: "该任务有新的待办或需要关注的事项，请在 Activity/Notify 中查看详细记录。"
  }
' | while read -r item; do
  if [ -z "${item}" ]; then
    continue
  fi
  payload="$(jq -c --argjson it "${item}" '{ action: "add", item: $it }' <<< '{}')"
  if ! post_json "/__data/notify" "${payload}"; then
    # 输出错误但不中断执行（错误信息已在 post_json 中输出到 stderr）
    echo "Warning: Failed to add notify for workitem $(echo "${item}" | jq -r '.workitemId // "unknown"')" >&2
  fi
done

# 根据 hooks 协议输出结果（无合并项，仅表示执行成功）
echo '{"ok": true, "items": []}'



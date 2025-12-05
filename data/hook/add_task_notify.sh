#!/usr/bin/env bash

set -euo pipefail

# 获取脚本的绝对路径并切换到脚本所在目录
# 这样无论从哪里执行脚本，工作目录都是脚本所在目录
SCRIPT_PATH="${BASH_SOURCE[0]}"
if [[ "${SCRIPT_PATH}" = /* ]]; then
  # 绝对路径
  SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_PATH}")" && pwd)"
else
  # 相对路径，需要结合当前工作目录
  SCRIPT_DIR="$(cd "$(dirname "$(pwd)/${SCRIPT_PATH}")" && pwd)"
fi

# 切换到脚本所在目录，确保后续路径解析正确
cd "${SCRIPT_DIR}" || {
  echo "Error: Cannot change to script directory: ${SCRIPT_DIR}" >&2
  exit 1
}

# 数据目录（脚本在 data/hook/ 下，所以 data 目录是上一级）
DATA_DIR="$(cd .. && pwd)"

# 读取服务状态信息
read_status_file() {
  local status_file="${DATA_DIR}/status.json"
  if [ ! -f "${status_file}" ]; then
    return 1
  fi

  # 使用 jq 解析 JSON（如果可用）
  if command -v jq >/dev/null 2>&1; then
    local url
    url="$(jq -r '.server.localUrl // .server.url // empty' "${status_file}" 2>/dev/null)"
    if [ -n "${url}" ] && [ "${url}" != "null" ]; then
      echo "${url}"
      return 0
    fi
  fi

  # 如果没有 jq，尝试简单的 grep 提取
  local url
  url="$(grep -o '"localUrl"[[:space:]]*:[[:space:]]*"[^"]*"' "${status_file}" 2>/dev/null | head -1 | sed 's/.*"localUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"
  if [ -n "${url}" ]; then
    echo "${url}"
    return 0
  fi

  # 最后尝试提取 url 字段
  url="$(grep -o '"url"[[:space:]]*:[[:space:]]*"[^"]*"' "${status_file}" 2>/dev/null | head -1 | sed 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"
  if [ -n "${url}" ]; then
    echo "${url}"
    return 0
  fi

  return 1
}

# 基础 API 地址：
# - 优先使用环境变量 HUBBLE_PAD_API_URL
# - 其次从 status.json 读取
# - 最后使用默认值
if [ -n "${HUBBLE_PAD_API_URL:-}" ]; then
  API_BASE="${HUBBLE_PAD_API_URL}"
else
  API_BASE="$(read_status_file 2>/dev/null || echo '')"
  if [ -z "${API_BASE}" ]; then
    # 默认值：优先尝试默认端口 10002，其次退回 8000（兼容旧配置）
    API_BASE="http://127.0.0.1:10002"
    ALT_API_BASE="http://127.0.0.1:8000"
  else
    ALT_API_BASE="${API_BASE}"
  fi
fi

# 检测可用的 API 地址
detect_api_base() {
  local test_url
  local error_msg
  local curl_output
  local curl_exit_code

  # 测试第一个 API 地址
  test_url="${API_BASE}/api/config"
  # 添加调试信息（输出到 stderr，不影响 JSON 输出）
  echo "[DEBUG] Testing API connection: ${test_url}" >&2
  echo "[DEBUG] Current working directory: $(pwd)" >&2
  echo "[DEBUG] DATA_DIR: ${DATA_DIR:-not set}" >&2
  echo "[DEBUG] status.json path: ${DATA_DIR:-unknown}/status.json" >&2

  # 测试 curl 是否可用
  if ! command -v curl >/dev/null 2>&1; then
    echo "[DEBUG] ERROR: curl command not found" >&2
    return 1
  fi

  # 尝试连接，捕获详细错误信息
  curl_output="$(curl -fsS --max-time 5 "${test_url}" 2>&1)"
  curl_exit_code=$?

  if [ ${curl_exit_code} -eq 0 ]; then
    echo "[DEBUG] API connection successful: ${API_BASE}" >&2
    echo "${API_BASE}"
    return 0
  fi

  echo "[DEBUG] API connection failed: ${test_url}" >&2
  echo "[DEBUG] curl exit code: ${curl_exit_code}" >&2
  echo "[DEBUG] curl output: ${curl_output}" >&2

  # 如果设置了备用地址，测试备用地址
  if [ -n "${ALT_API_BASE:-}" ] && [ "${ALT_API_BASE}" != "${API_BASE}" ]; then
    test_url="${ALT_API_BASE}/api/config"
    echo "[DEBUG] Testing alternative API: ${test_url}" >&2
    curl_output="$(curl -fsS --max-time 5 "${test_url}" 2>&1)"
    curl_exit_code=$?
    if [ ${curl_exit_code} -eq 0 ]; then
      echo "[DEBUG] Alternative API connection successful: ${ALT_API_BASE}" >&2
      echo "${ALT_API_BASE}"
      return 0
    fi
    echo "[DEBUG] Alternative API connection failed: ${test_url}" >&2
    echo "[DEBUG] curl exit code: ${curl_exit_code}" >&2
    echo "[DEBUG] curl output: ${curl_output}" >&2
  fi

  # 如果都失败，输出详细错误信息
  error_msg="无法连接到 API 服务器。"
  if [ -n "${ALT_API_BASE:-}" ] && [ "${ALT_API_BASE}" != "${API_BASE}" ]; then
    error_msg="${error_msg} 尝试的地址: ${API_BASE} 和 ${ALT_API_BASE}"
  else
    error_msg="${error_msg} 尝试的地址: ${API_BASE}"
  fi
  error_msg="${error_msg} 请确保开发服务器正在运行。"
  echo "${error_msg}" >&2
  return 1
}

# 确定实际使用的 API 地址（如果失败，输出错误 JSON 并退出）
ACTUAL_API_BASE="$(detect_api_base 2>/dev/null)" || {
  if [ -n "${ALT_API_BASE:-}" ] && [ "${ALT_API_BASE}" != "${API_BASE}" ]; then
    echo "response={\"ok\": false, \"error\": \"无法连接到 API 服务器，请确保开发服务器正在运行（尝试了 ${API_BASE} 和 ${ALT_API_BASE}）\", \"items\": []}"
  else
    echo "response={\"ok\": false, \"error\": \"无法连接到 API 服务器，请确保开发服务器正在运行（尝试了 ${API_BASE}）\", \"items\": []}"
  fi
  exit 1
}

get_json() {
  local path="$1"
  curl -fsS --max-time 5 "${ACTUAL_API_BASE}${path}" 2>/dev/null || return 1
}

post_json() {
  local path="$1"
  local data="$2"
  local response
  response="$(curl -fsS --max-time 5 -X POST "${ACTUAL_API_BASE}${path}" \
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

# 错误处理函数：输出错误 JSON 并退出
handle_error() {
  local msg="$1"
  echo "response={\"ok\": false, \"error\": \"${msg}\", \"items\": []}"
  exit 1
}

# 读取当前 workitems（只关心 kind === "task" 的工作项）
workitems_json="$(get_json "/data/workitems.json" || echo '[]')"
if [ -z "${workitems_json}" ]; then
  handle_error "无法读取 workitems.json"
fi

# 检查 jq 是否可用
if ! command -v jq >/dev/null 2>&1; then
  handle_error "jq 命令不可用，请安装 jq"
fi

# 使用 jq 生成需要添加的提醒项（每个 task 类型的 workitem 一条提醒）
error_count=0
echo "${workitems_json}" | jq -c '
  .[] | select(.kind == "task") |
  {
    workitemId: .id,
    title: ("任务提醒：" + (.title // .id)),
    content: "该任务有新的待办或需要关注的事项，请在 Activity/Notify 中查看详细记录。"
  }
' 2>/dev/null | while read -r item; do
  if [ -z "${item}" ]; then
    continue
  fi
  payload="$(jq -c --argjson it "${item}" '{ action: "add", item: $it }' <<< '{}' 2>/dev/null)"
  if [ -z "${payload}" ]; then
    echo "Warning: Failed to create payload for workitem $(echo "${item}" | jq -r '.workitemId // "unknown"' 2>/dev/null || echo 'unknown')" >&2
    error_count=$((error_count + 1))
    continue
  fi
  if ! post_json "/__data/notify" "${payload}"; then
    # 输出错误但不中断执行（错误信息已在 post_json 中输出到 stderr）
    echo "Warning: Failed to add notify for workitem $(echo "${item}" | jq -r '.workitemId // "unknown"' 2>/dev/null || echo 'unknown')" >&2
    error_count=$((error_count + 1))
  fi
done

# 根据 hooks 协议输出结果（无合并项，仅表示执行成功）
# 如果有错误，在 stderr 中记录，但依然返回成功（因为部分可能成功）
if [ ${error_count:-0} -gt 0 ]; then
  echo "Warning: ${error_count} 个提醒添加失败，请查看 stderr 获取详细信息" >&2
fi
# 输出 JSON 结果，使用 response= 格式，允许脚本输出其他调试信息
echo "response={\"ok\": true, \"items\": []}"



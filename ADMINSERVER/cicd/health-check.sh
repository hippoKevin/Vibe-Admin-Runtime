#!/usr/bin/env bash
# ============================================================
# 健康检查：轮询系统运维提供的 ping 接口
# 用法：bash ADMINSERVER/cicd/health-check.sh
#      HEALTH_CHECK_URL=http://127.0.0.1:5004/hippoadmin/system-ops/ping
# ============================================================

set -euo pipefail

URL="${HEALTH_CHECK_URL:-http://127.0.0.1:5004/hippoadmin/system-ops/ping}"
RETRIES="${HEALTH_CHECK_RETRIES:-15}"
INTERVAL="${HEALTH_CHECK_INTERVAL:-2}"

for i in $(seq 1 "${RETRIES}"); do
  if curl -fsS --max-time 3 "${URL}" 2>/dev/null | grep -q '"code":2000'; then
    echo "[cicd] 健康检查通过（第 ${i} 次）：${URL}"
    exit 0
  fi

  echo "[cicd] 第 ${i}/${RETRIES} 次探测未通过，${INTERVAL} 秒后重试"
  sleep "${INTERVAL}"
done

echo "[cicd] 健康检查失败：${URL}" >&2
echo "[cicd] 建议查看：pm2 logs ${PM2_APP_NAME:-main} --lines 100" >&2
exit 1

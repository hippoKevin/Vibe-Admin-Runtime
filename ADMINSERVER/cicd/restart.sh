#!/usr/bin/env bash
# ============================================================
# 重启后端服务（PM2）
# 用法：PM2_APP_NAME=main bash ADMINSERVER/cicd/restart.sh
#
# 说明：系统运维页面「保存并重启」依赖 PM2 托管——
#       后端检测到 pm_id/PM2_HOME 时会 process.exit(0)，由 PM2 自动拉起，
#       所以这里用 restart/reload 的方式与页面上的重启保持一致。
# ============================================================

set -euo pipefail

source "$(dirname "$0")/common.sh"

APP_NAME="${PM2_APP_NAME:-main}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[cicd] 未找到 pm2，请手动重启后端（例如 npm run start:dev）" >&2
  exit 1
fi

echo "[cicd] 重启 PM2 应用：${APP_NAME}"
pm2 reload "${APP_NAME}" --update-env || pm2 restart "${APP_NAME}" --update-env

pm2 save >/dev/null 2>&1 || true
pm2 list

echo "[cicd] 重启指令已下发"

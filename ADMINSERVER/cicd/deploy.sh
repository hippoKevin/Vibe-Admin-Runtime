#!/usr/bin/env bash
# ============================================================
# CD：服务器端部署（拉代码 → 装依赖 → 构建 → 重启 PM2 → 健康检查）
#
# 用法：
#   在服务器仓库根目录执行
#     bash ADMINSERVER/cicd/deploy.sh
#   或由 GitHub Actions 通过 SSH 调用（见 .github/workflows/cd-server.yml）
#
# 可用环境变量：
#   DEPLOY_BRANCH  部署分支，默认 main
#   SKIP_GIT=1     跳过 git 拉取（只重新构建与重启）
#   PKG_MANAGER    强制包管理器：pnpm / npm
#   PM2_APP_NAME   PM2 应用名，默认 main
#
# 注意：默认执行 git reset --hard origin/<branch>，
#       服务器上的本地改动会被覆盖，这是 CD 的预期行为。
# ============================================================

set -euo pipefail

source "$(dirname "$0")/common.sh"

BRANCH="${DEPLOY_BRANCH:-main}"

echo "[cicd] 仓库目录：${REPO_DIR}"
echo "[cicd] 后端目录：${SERVER_DIR}"
echo "[cicd] 部署分支：${BRANCH}"

if [ "${SKIP_GIT:-0}" != "1" ]; then
  echo "[cicd] 拉取最新代码..."
  git -C "${REPO_DIR}" fetch --all --prune
  git -C "${REPO_DIR}" reset --hard "origin/${BRANCH}"
  git -C "${REPO_DIR}" log -1 --oneline
fi

PM="$(detect_pkg_manager)"
echo "[cicd] 包管理器：${PM}"

cd "${SERVER_DIR}"

echo "[cicd] 安装依赖..."
pkg_install "${PM}"

echo "[cicd] 构建..."
run_script "${PM}" build

echo "[cicd] 重启服务..."
bash "${CICD_DIR}/restart.sh"

echo "[cicd] 健康检查..."
bash "${CICD_DIR}/health-check.sh"

echo "[cicd] 部署完成"

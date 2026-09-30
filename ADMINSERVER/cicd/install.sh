#!/usr/bin/env bash
# ============================================================
# CI：安装后端依赖（CI 与服务器部署共用）
# 用法：bash ADMINSERVER/cicd/build.sh   （由 build.sh 调用）
#      PKG_MANAGER=npm bash cicd/install.sh
# ============================================================

set -euo pipefail

source "$(dirname "$0")/common.sh"

PM="$(detect_pkg_manager)"
echo "[cicd] 后端目录：${SERVER_DIR}"
echo "[cicd] 包管理器：${PM}"

cd "${SERVER_DIR}"
pkg_install "${PM}"

echo "[cicd] 依赖安装完成"

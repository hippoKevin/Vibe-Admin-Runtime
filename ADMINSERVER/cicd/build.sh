#!/usr/bin/env bash
# ============================================================
# CI：安装依赖 + 构建后端（可选跑单元测试）
# 用法：bash ADMINSERVER/cicd/build.sh
#      RUN_TESTS=1 bash ADMINSERVER/cicd/build.sh
#      SKIP_INSTALL=1 bash ADMINSERVER/cicd/build.sh   # 依赖已装好时跳过安装
# ============================================================

set -euo pipefail

source "$(dirname "$0")/common.sh"

PM="$(detect_pkg_manager)"
echo "[cicd] 后端目录：${SERVER_DIR}"
echo "[cicd] 包管理器：${PM}"

cd "${SERVER_DIR}"

if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  echo "[cicd] 安装依赖..."
  pkg_install "${PM}"
else
  echo "[cicd] 跳过依赖安装（SKIP_INSTALL=1）"
fi

echo "[cicd] 编译（nest build）..."
run_script "${PM}" build

if [ "${RUN_TESTS:-0}" = "1" ]; then
  echo "[cicd] 单元测试..."
  # 目前仓库里没有单元测试，--passWithNoTests 让空用例也算通过
  run_script "${PM}" test -- --passWithNoTests
fi

echo "[cicd] 构建完成：${SERVER_DIR}/dist"

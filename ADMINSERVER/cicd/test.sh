#!/usr/bin/env bash
# ============================================================
# CI：后端单元测试
# 用法：bash ADMINSERVER/cicd/test.sh
#
# 说明：目前仓库里没有单元测试用例，--passWithNoTests 让空用例也算通过；
#       后续补了用例就会自动生效。
# ============================================================

set -euo pipefail

source "$(dirname "$0")/common.sh"

PM="$(detect_pkg_manager)"
echo "[cicd] 包管理器：${PM}"

cd "${SERVER_DIR}"
echo "[cicd] 单元测试..."
run_script "${PM}" test -- --passWithNoTests

echo "[cicd] 单元测试通过"

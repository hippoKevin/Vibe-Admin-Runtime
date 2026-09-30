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

# 没有任何 .spec.ts 用例时直接跳过：
# 一是没必要启动 jest，二是 pnpm 的严格 node_modules 布局下
# jest 的部分传递依赖（jest-environment-node 等）解析不到会直接报错。
if ! find src -name '*.spec.ts' -print -quit | grep -q .; then
  echo "[cicd] src 下暂无用例，跳过单元测试"
  exit 0
fi

echo "[cicd] 单元测试..."
run_script "${PM}" test -- --passWithNoTests

echo "[cicd] 单元测试通过"

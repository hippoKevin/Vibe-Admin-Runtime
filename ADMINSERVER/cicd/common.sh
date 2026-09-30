#!/usr/bin/env bash
# ============================================================
# CI/CD 公共函数：定位目录、选择包管理器、安装依赖、执行脚本
# 用法：source "$(dirname "$0")/common.sh"
# ============================================================

set -euo pipefail

# 本文件位于 ADMINSERVER/cicd/，据此推导三个关键目录，避免写死绝对路径
CICD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${CICD_DIR}/.." && pwd)"
REPO_DIR="$(cd "${SERVER_DIR}/.." && pwd)"

# 包管理器：PKG_MANAGER 可强制指定；否则有 pnpm 锁文件且装了 pnpm 就用 pnpm，其余用 npm
detect_pkg_manager() {
  if [ -n "${PKG_MANAGER:-}" ]; then
    echo "${PKG_MANAGER}"
    return 0
  fi

  if [ -f "${SERVER_DIR}/pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
    echo "pnpm"
    return 0
  fi

  echo "npm"
}

# 安装依赖：pnpm 用 --frozen-lockfile 保证可复现；npm 有锁文件用 ci
pkg_install() {
  local pm="$1"

  if [ "${pm}" = "pnpm" ]; then
    echo "[cicd] pnpm install --frozen-lockfile"
    pnpm install --frozen-lockfile
    return 0
  fi

  if [ -f "${SERVER_DIR}/package-lock.json" ]; then
    echo "[cicd] npm ci"
    npm ci
  else
    echo "[cicd] npm install"
    npm install
  fi
}

# 执行 package.json 中的脚本：run_script "${PM}" build
run_script() {
  local pm="$1"
  shift

  if [ "${pm}" = "pnpm" ]; then
    pnpm run "$@"
  else
    npm run "$@"
  fi
}

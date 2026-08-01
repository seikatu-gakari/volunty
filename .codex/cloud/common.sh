#!/usr/bin/env bash
set -euo pipefail

codex_cloud_log() {
  printf '[codex-cloud] %s\n' "$*" >&2
}

codex_cloud_require_node_22() {
  if ! command -v node >/dev/null 2>&1; then
    codex_cloud_log "Node.js 22.12+ が見つかりません。Cloud Environment の Node.js を 22 系に設定してください。"
    return 1
  fi

  local version major minor
  version="$(node --version)"
  if [[ ! "$version" =~ ^v([0-9]+)\.([0-9]+)\.[0-9]+$ ]]; then
    codex_cloud_log "Node.js のバージョンを判定できません: $version"
    return 1
  fi

  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  if [ "$major" != "22" ] || [ "$minor" -lt 12 ]; then
    codex_cloud_log "Node.js 22.12+ が必要です: $version"
    return 1
  fi
}

codex_cloud_setup_dependencies() {
  local repo_root="$1"
  local app_dir="$repo_root/app"

  if [ ! -f "$app_dir/package.json" ]; then
    codex_cloud_log "app/package.json が見つかりません: $app_dir/package.json"
    return 1
  fi

  if [ ! -f "$app_dir/package-lock.json" ]; then
    codex_cloud_log "app/package-lock.json が見つかりません。npm ci に必要です。"
    return 1
  fi

  if ! command -v npm >/dev/null 2>&1; then
    codex_cloud_log "npm が見つかりません。Cloud Environment の Node.js 設定を確認してください。"
    return 1
  fi

  codex_cloud_require_node_22

  codex_cloud_log "依存関係をインストールします。"
  cd "$app_dir"
  npm ci --no-audit

  codex_cloud_log "Prisma Client を生成します。"
  npm run db:generate
  codex_cloud_log "セットアップが完了しました。"
}

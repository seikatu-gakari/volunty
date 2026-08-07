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

codex_cloud_cli_version_matches() {
  local command_name="$1"
  local actual_version="$2"
  local expected_version="$3"

  if [ "$actual_version" = "$expected_version" ]; then
    return 0
  fi

  case "$command_name:$actual_version" in
    "ctx7:ctx7 $expected_version" | "vercel:Vercel CLI $expected_version")
      return 0
      ;;
  esac

  return 1
}

codex_cloud_setup_pinned_cli() {
  local command_name="$1"
  local package_name="$2"
  local expected_version="$3"
  local display_name="$4"
  local installed_version

  if command -v "$command_name" >/dev/null 2>&1; then
    installed_version="$($command_name --version 2>/dev/null || true)"
    if codex_cloud_cli_version_matches "$command_name" "$installed_version" "$expected_version"; then
      codex_cloud_log "$display_name はセットアップ済みです: $command_name $expected_version"
      return 0
    fi
  fi

  if ! command -v npm >/dev/null 2>&1; then
    codex_cloud_log "$display_name の導入に npm が必要です。"
    return 1
  fi

  codex_cloud_log "$display_name をインストールします: $package_name@$expected_version"
  if ! npm install --global --no-audit --no-fund "$package_name@$expected_version"; then
    codex_cloud_log "$display_name のインストールに失敗しました。"
    return 1
  fi
  hash -r 2>/dev/null || true

  if ! command -v "$command_name" >/dev/null 2>&1; then
    codex_cloud_log "$display_name のインストール後に $command_name が見つかりません。"
    return 1
  fi

  installed_version="$($command_name --version 2>/dev/null || true)"
  if ! codex_cloud_cli_version_matches "$command_name" "$installed_version" "$expected_version"; then
    codex_cloud_log "$display_name のバージョンが一致しません: expected=$expected_version actual=${installed_version:-unknown}"
    return 1
  fi
}

codex_cloud_setup_context7_cli() {
  codex_cloud_setup_pinned_cli "ctx7" "ctx7" "0.5.7" "Context7 CLI"
}

codex_cloud_setup_vercel_cli() {
  codex_cloud_setup_pinned_cli "vercel" "vercel" "58.7.1" "Vercel CLI"
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
  codex_cloud_setup_context7_cli
  codex_cloud_setup_vercel_cli

  codex_cloud_log "依存関係をインストールします。"
  cd "$app_dir"
  npm ci --no-audit

  codex_cloud_log "Prisma Client を生成します。"
  npm run db:generate
  codex_cloud_log "セットアップが完了しました。"
}

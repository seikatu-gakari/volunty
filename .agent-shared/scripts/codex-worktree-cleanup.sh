#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[codex-worktree-cleanup] %s\n' "$*"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

has_worktree_docker_compose_resources() {
  local container_ids

  if ! command_exists docker; then
    log "Docker が見つからないため、Docker Compose の削除をスキップします。"
    return 1
  fi

  if ! container_ids="$(docker ps -aq --filter "label=com.docker.compose.project.working_dir=$repo_root" 2>/dev/null)"; then
    log "Docker daemon に接続できないため、Docker Compose の削除をスキップします。"
    return 1
  fi

  [ -n "$container_ids" ]
}

cleanup_docker_compose() {
  if ! has_worktree_docker_compose_resources; then
    log "この worktree で作成された Docker Compose 環境は見つかりません。"
    return 0
  fi

  log "この worktree で作成された Docker Compose 環境を削除します。"
  if docker compose down -v; then
    log "Docker Compose 環境を削除しました。"
  else
    log "Docker Compose 環境の削除に失敗しました。"
    return 1
  fi
}

has_supabase_local_state() {
  local temp_dir="$repo_root/supabase/.temp"

  [ -d "$temp_dir" ] && find "$temp_dir" -mindepth 1 ! -name cli-latest -print -quit | grep -q .
}

cleanup_supabase() {
  if ! command_exists supabase; then
    log "Supabase CLI が見つからないため、Supabase ローカル環境の削除をスキップします。"
    return 0
  fi

  if ! has_supabase_local_state; then
    log "この worktree で作成された Supabase ローカル状態は見つかりません。"
    return 0
  fi

  log "この worktree の Supabase ローカル環境をバックアップなしで削除します。"
  if (
    cd "$repo_root"
    set -a
    if [ -f ./app/.env.local ]; then
      . ./app/.env.local
    fi
    set +a
    supabase stop --no-backup
  ); then
    log "Supabase ローカル環境を削除しました。"
  else
    log "Supabase ローカル環境の削除に失敗しました。"
    return 1
  fi
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

cd "$repo_root"

log "Repository: $repo_root"
log "Codex がこの後 worktree ディレクトリ全体を削除します。"
log "worktree 内の node_modules やビルド成果物は、ディレクトリ削除に含まれます。"
cleanup_docker_compose
cleanup_supabase
log "クリーンアップ前処理が完了しました。"

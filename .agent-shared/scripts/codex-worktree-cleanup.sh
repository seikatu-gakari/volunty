#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[codex-worktree-cleanup] %s\n' "$*"
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

cd "$repo_root"

log "Repository: $repo_root"
log "Codex がこの後 worktree ディレクトリ全体を削除します。"
log "worktree 内の node_modules やビルド成果物は、ディレクトリ削除に含まれます。"
log "Docker / Supabase / dev server は setup script で起動しないため、ここでは停止処理を行いません。"
log "クリーンアップ前処理が完了しました。"

#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[codex-worktree-cleanup] %s\n' "$*"
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

cd "$repo_root"

log "Repository: $repo_root"

for path in \
  "app/.next" \
  "app/coverage" \
  "app/.turbo" \
  "app/tsconfig.tsbuildinfo" \
  "app/next-env.d.ts"
do
  if [ -e "$path" ]; then
    log "生成物を削除します: $path"
    rm -rf "$path"
  fi
done

log "Docker / Supabase / node_modules は削除・停止しません。"
log "クリーンアップが完了しました。"

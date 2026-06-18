#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '[codex-worktree-setup] %s\n' "$*"
}

node_is_supported() {
  local node_bin="$1"

  "$node_bin" -e '
const [major, minor] = process.versions.node.split(".").map(Number);
const supported = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 24;
process.exit(supported ? 0 : 1);
' >/dev/null 2>&1
}

find_supported_node() {
  local current_node
  current_node="$(command -v node 2>/dev/null || true)"

  shopt -s nullglob
  local candidates=(
    "$current_node"
    "/Applications/Codex.app/Contents/Resources/cua_node/bin/node"
    "$HOME"/.nodebrew/current/bin/node
    "$HOME"/.nodebrew/node/v*/bin/node
    "$HOME"/.config/nvm/versions/node/v*/bin/node
    "$HOME"/.nvm/versions/node/v*/bin/node
    /opt/homebrew/bin/node
    /usr/local/bin/node
  )
  shopt -u nullglob

  local node_bin npm_bin
  local -A seen=()
  for node_bin in "${candidates[@]}"; do
    if [ -z "$node_bin" ] || [ "${seen[$node_bin]+x}" ]; then
      continue
    fi
    seen["$node_bin"]=1

    npm_bin="$(dirname "$node_bin")/npm"
    if [ -x "$node_bin" ] && [ -x "$npm_bin" ] && node_is_supported "$node_bin"; then
      printf '%s\n' "$node_bin"
      return 0
    fi
  done

  return 1
}

configure_supported_node() {
  local node_bin node_dir
  node_bin="$(find_supported_node || true)"

  if [ -z "$node_bin" ]; then
    log "Node.js 20.19+ / 22.12+ / 24+ が見つかりません。Prisma 7.6.0 の要件を満たす Node.js をインストールしてください。"
    exit 1
  fi

  node_dir="$(dirname "$node_bin")"
  export PATH="$node_dir:$PATH"
  hash -r
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
app_dir="$repo_root/app"

cd "$repo_root"

if [ ! -f "$app_dir/package.json" ]; then
  log "app/package.json が見つからないため、セットアップをスキップします。"
  exit 0
fi

configure_supported_node

log "Repository: $repo_root"
log "Node: $(node --version 2>/dev/null || printf 'not found')"
log "npm: $(npm --version 2>/dev/null || printf 'not found')"

if [ ! -f "$app_dir/.env.local" ]; then
  log "app/.env.local がありません。必要な場合は local checkout で用意し、.worktreeinclude で worktree にコピーしてください。"
fi

cd "$app_dir"

if [ -f package-lock.json ]; then
  log "npm ci を実行します。"
  npm ci --no-audit
else
  log "package-lock.json がないため npm install を実行します。"
  npm install --no-audit
fi

log "Prisma Client を生成します。"
npm run db:generate

log "セットアップが完了しました。"

#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
status_file="${1:-}"

if [ -z "$repo_root" ]; then
  printf '[e2e-env] Git repository root を解決できません。\n' >&2
  exit 1
fi

if [ -z "$status_file" ] || [ ! -f "$status_file" ]; then
  printf '[e2e-env] Supabase status file が見つかりません。\n' >&2
  exit 1
fi

app_dir="$repo_root/app"
if [ ! -d "$app_dir" ]; then
  printf '[e2e-env] app ディレクトリが見つかりません: %s\n' "$app_dir" >&2
  exit 1
fi

# `supabase status -o env` は Supabase CLI 自身が生成した shell assignment のみを読む。
set -a
# shellcheck disable=SC1090
. "$status_file"
set +a

: "${API_URL:?Supabase API_URL is missing}"
: "${ANON_KEY:?Supabase ANON_KEY is missing}"
: "${SERVICE_ROLE_KEY:?Supabase SERVICE_ROLE_KEY is missing}"
: "${DB_URL:?Supabase DB_URL is missing}"

umask 077
tmp_env="$(mktemp "${TMPDIR:-/tmp}/volunty-e2e-env.XXXXXX")"
trap 'rm -f "$tmp_env"' EXIT

printf '%s\n' \
  "NEXT_PUBLIC_SUPABASE_URL=$API_URL" \
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY" \
  "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY" \
  "DATABASE_URL=$DB_URL" \
  "DIRECT_URL=$DB_URL" \
  'E2E_AUTH_ENABLED=true' \
  'E2E_TEST_USER_PASSWORD=volunty-e2e-password' \
  > "$tmp_env"

mv "$tmp_env" "$app_dir/.env.local"
printf '[e2e-env] app/.env.local を生成しました。\n'

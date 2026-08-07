#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  local file="$1"
  local expected="$2"

  grep -Fqx "$expected" "$file" || {
    printf 'Expected to find line: %s\n' "$expected" >&2
    printf 'Actual content:\n' >&2
    cat "$file" >&2
    return 1
  }
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"

  if grep -Fq "$unexpected" "$file"; then
    printf 'Expected not to find: %s\n' "$unexpected" >&2
    printf 'Actual content:\n' >&2
    cat "$file" >&2
    return 1
  fi
}

prepare_repo() {
  local repo="$1"

  mkdir -p "$repo/app"
  git -C "$repo" init -q
}

write_status_env() {
  local status_file="$1"

  cat > "$status_file" <<'EOF'
API_URL="http://127.0.0.1:54321"
ANON_KEY="local-anon-key"
SERVICE_ROLE_KEY="local-service-role-key"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
EOF
}

run_helper() {
  local repo="$1"
  local status_file="$2"
  local stdout_file="$3"
  local stderr_file="$4"

  (cd "$repo" && bash "$script_dir/prepare-e2e-env.sh" "$status_file" >"$stdout_file" 2>"$stderr_file")
}

test_generates_local_e2e_environment_without_logging_secrets() {
  local tmp_dir repo status_file stdout_file stderr_file env_file
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  status_file="$tmp_dir/supabase.env"
  stdout_file="$tmp_dir/stdout.log"
  stderr_file="$tmp_dir/stderr.log"
  env_file="$repo/app/.env.local"

  prepare_repo "$repo"
  write_status_env "$status_file"
  run_helper "$repo" "$status_file" "$stdout_file" "$stderr_file"

  assert_contains "$env_file" "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"
  assert_contains "$env_file" "NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key"
  assert_contains "$env_file" "SUPABASE_SERVICE_ROLE_KEY=local-service-role-key"
  assert_contains "$env_file" "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  assert_contains "$env_file" "DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  assert_contains "$env_file" "E2E_AUTH_ENABLED=true"
  assert_contains "$env_file" "E2E_TEST_USER_PASSWORD=volunty-e2e-password"
  assert_not_contains "$stdout_file" "local-service-role-key"
  assert_not_contains "$stderr_file" "local-service-role-key"
}

test_requires_status_file() {
  local tmp_dir repo stdout_file stderr_file
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  stdout_file="$tmp_dir/stdout.log"
  stderr_file="$tmp_dir/stderr.log"

  prepare_repo "$repo"
  if run_helper "$repo" "$tmp_dir/missing.env" "$stdout_file" "$stderr_file"; then
    fail "helper succeeded without a Supabase status file"
  fi

  [ ! -f "$repo/app/.env.local" ] || fail "helper created env file without status input"
}

test_requires_supabase_values() {
  local tmp_dir repo status_file stdout_file stderr_file
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  status_file="$tmp_dir/supabase.env"
  stdout_file="$tmp_dir/stdout.log"
  stderr_file="$tmp_dir/stderr.log"

  prepare_repo "$repo"
  printf 'API_URL="http://127.0.0.1:54321"\n' > "$status_file"
  if run_helper "$repo" "$status_file" "$stdout_file" "$stderr_file"; then
    fail "helper succeeded without required Supabase values"
  fi

  [ ! -f "$repo/app/.env.local" ] || fail "helper created partial env file"
}

test_generates_local_e2e_environment_without_logging_secrets
test_requires_status_file
test_requires_supabase_values

printf 'E2E environment helper tests passed\n'

#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
script_under_test="$script_dir/codex-worktree-cleanup.sh"

assert_contains() {
  local file="$1"
  local expected="$2"

  if ! grep -Fq "$expected" "$file"; then
    printf 'Expected to find: %s\n' "$expected" >&2
    printf 'Actual log:\n' >&2
    cat "$file" >&2
    return 1
  fi
}

assert_not_contains() {
  local file="$1"
  local unexpected="$2"

  if grep -Fq "$unexpected" "$file"; then
    printf 'Expected not to find: %s\n' "$unexpected" >&2
    printf 'Actual log:\n' >&2
    cat "$file" >&2
    return 1
  fi
}

prepare_repo() {
  local repo="$1"

  mkdir -p "$repo"/{.agent-shared/scripts,supabase}
  cp "$script_under_test" "$repo/.agent-shared/scripts/codex-worktree-cleanup.sh"
  git -C "$repo" init -q
}

write_fake_commands() {
  local bin_dir="$1"
  local call_log="$2"
  local docker_has_worktree_resource="$3"

  mkdir -p "$bin_dir"

  cat > "$bin_dir/docker" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\n' "\$*" >> "$call_log"
if [ "\${1:-}" = "ps" ]; then
  if [ "$docker_has_worktree_resource" = "yes" ]; then
    printf 'container-1\n'
  fi
  exit 0
fi
exit 0
EOF

  cat > "$bin_dir/supabase" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'supabase %s\n' "\$*" >> "$call_log"
exit 0
EOF

  chmod +x "$bin_dir/docker" "$bin_dir/supabase"
}

run_cleanup() {
  local repo="$1"
  local bin_dir="$2"

  (cd "$repo" && PATH="$bin_dir:$PATH" "$repo/.agent-shared/scripts/codex-worktree-cleanup.sh" >/dev/null)
}

test_stops_docker_compose_for_current_worktree() {
  local tmp_dir repo bin_dir call_log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  bin_dir="$tmp_dir/bin"
  call_log="$tmp_dir/calls.log"
  touch "$call_log"

  prepare_repo "$repo"
  repo="$(cd "$repo" && pwd -P)"
  write_fake_commands "$bin_dir" "$call_log" yes

  run_cleanup "$repo" "$bin_dir"

  assert_contains "$call_log" "docker ps -aq --filter label=com.docker.compose.project.working_dir=$repo"
  assert_contains "$call_log" "docker compose down -v"
}

test_skips_docker_compose_without_current_worktree_resource() {
  local tmp_dir repo bin_dir call_log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  bin_dir="$tmp_dir/bin"
  call_log="$tmp_dir/calls.log"
  touch "$call_log"

  prepare_repo "$repo"
  repo="$(cd "$repo" && pwd -P)"
  write_fake_commands "$bin_dir" "$call_log" no

  run_cleanup "$repo" "$bin_dir"

  assert_contains "$call_log" "docker ps -aq --filter label=com.docker.compose.project.working_dir=$repo"
  assert_not_contains "$call_log" "docker compose down -v"
}

test_stops_supabase_when_temp_state_exists() {
  local tmp_dir repo bin_dir call_log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  bin_dir="$tmp_dir/bin"
  call_log="$tmp_dir/calls.log"
  touch "$call_log"

  prepare_repo "$repo"
  repo="$(cd "$repo" && pwd -P)"
  mkdir -p "$repo/supabase/.temp"
  touch "$repo/supabase/.temp/pooler-url"
  write_fake_commands "$bin_dir" "$call_log" no

  run_cleanup "$repo" "$bin_dir"

  assert_contains "$call_log" "supabase stop --no-backup"
}

test_skips_supabase_without_temp_state() {
  local tmp_dir repo bin_dir call_log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  bin_dir="$tmp_dir/bin"
  call_log="$tmp_dir/calls.log"
  touch "$call_log"

  prepare_repo "$repo"
  repo="$(cd "$repo" && pwd -P)"
  write_fake_commands "$bin_dir" "$call_log" no

  run_cleanup "$repo" "$bin_dir"

  assert_not_contains "$call_log" "supabase stop --no-backup"
}

test_stops_docker_compose_for_current_worktree
test_skips_docker_compose_without_current_worktree_resource
test_stops_supabase_when_temp_state_exists
test_skips_supabase_without_temp_state

printf 'codex-worktree-cleanup tests passed\n'

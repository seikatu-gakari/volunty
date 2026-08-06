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
    printf 'Actual log:\n' >&2
    cat "$file" >&2
    return 1
  }
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

  mkdir -p "$repo/app"
  printf '{}\n' > "$repo/app/package.json"
  printf '{}\n' > "$repo/app/package-lock.json"
  git -C "$repo" init -q
}

write_fake_commands() {
  local bin_dir="$1"
  local call_log="$2"
  local node_version="$3"
  local cli_call_log="${call_log}.cli"

  mkdir -p "$bin_dir"
  touch "$cli_call_log"

  cat > "$bin_dir/node" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [ "\${1:-}" = "--version" ]; then
  printf '%s\\n' "$node_version"
  printf 'node --version\\n' >> "$call_log"
  exit 0
fi
printf 'node %s\\n' "\$*" >> "$call_log"
EOF

  cat > "$bin_dir/npm" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'npm %s\\n' "\$*" >> "$call_log"
EOF

  cat > "$bin_dir/docker" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\\n' "\$*" >> "$call_log"
EOF

  cat > "$bin_dir/supabase" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'supabase %s\\n' "\$*" >> "$call_log"
EOF

  cat > "$bin_dir/ctx7" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'ctx7 %s\\n' "\$*" >> "$cli_call_log"
if [ "\${1:-}" = "--version" ]; then
  printf '0.5.7\\n'
fi
EOF

  cat > "$bin_dir/vercel" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf 'vercel %s\\n' "\$*" >> "$cli_call_log"
if [ "\${1:-}" = "--version" ]; then
  printf '58.7.1\\n'
fi
EOF

  chmod +x "$bin_dir/node" "$bin_dir/npm" "$bin_dir/docker" "$bin_dir/supabase" "$bin_dir/ctx7" "$bin_dir/vercel"
}

run_entrypoint() {
  local repo="$1"
  local bin_dir="$2"
  local entrypoint="$3"

  (cd "$repo" && PATH="$bin_dir:$PATH" bash "$script_dir/$entrypoint" >/dev/null)
}

test_setup_runs_dependencies_in_order() {
  local tmp_dir repo bin_dir call_log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  bin_dir="$tmp_dir/bin"
  call_log="$tmp_dir/calls.log"
  touch "$call_log"

  prepare_repo "$repo"
  write_fake_commands "$bin_dir" "$call_log" "v22.12.0"
  run_entrypoint "$repo" "$bin_dir" "setup.sh"

  local expected actual
  expected=$'node --version\nnpm ci --no-audit\nnpm run db:generate'
  actual="$(cat "$call_log")"
  [ "$actual" = "$expected" ] || fail "setup call order was unexpected"
  assert_contains "${call_log}.cli" "ctx7 --version"
  assert_contains "${call_log}.cli" "vercel --version"
  assert_not_contains "$call_log" "npm install --global"
  assert_not_contains "$call_log" "mcpc"
}

test_maintenance_runs_dependencies_in_order() {
  local tmp_dir repo bin_dir call_log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  bin_dir="$tmp_dir/bin"
  call_log="$tmp_dir/calls.log"
  touch "$call_log"

  prepare_repo "$repo"
  write_fake_commands "$bin_dir" "$call_log" "v22.12.0"
  run_entrypoint "$repo" "$bin_dir" "maintenance.sh"

  local expected actual
  expected=$'node --version\nnpm ci --no-audit\nnpm run db:generate'
  actual="$(cat "$call_log")"
  [ "$actual" = "$expected" ] || fail "maintenance call order was unexpected"
  assert_contains "${call_log}.cli" "ctx7 --version"
  assert_contains "${call_log}.cli" "vercel --version"
  assert_not_contains "$call_log" "npm install --global"
  assert_not_contains "$call_log" "mcpc"
}

test_rejects_unsupported_node_versions() {
  local version tmp_dir repo bin_dir call_log

  for version in v20.19.0 v22.11.0; do
    tmp_dir="$(mktemp -d)"
    repo="$tmp_dir/repo"
    bin_dir="$tmp_dir/bin"
    call_log="$tmp_dir/calls.log"
    touch "$call_log"

    prepare_repo "$repo"
    write_fake_commands "$bin_dir" "$call_log" "$version"

    if run_entrypoint "$repo" "$bin_dir" "setup.sh"; then
      fail "setup accepted unsupported Node.js version $version"
    fi

    assert_contains "$call_log" "node --version"
    assert_not_contains "$call_log" "npm "
  done
}

test_does_not_start_external_services_or_source_env() {
  local tmp_dir repo bin_dir call_log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  bin_dir="$tmp_dir/bin"
  call_log="$tmp_dir/calls.log"
  touch "$call_log"

  prepare_repo "$repo"
  printf 'command_that_must_not_run\n' > "$repo/app/.env.local"
  write_fake_commands "$bin_dir" "$call_log" "v22.12.0"
  run_entrypoint "$repo" "$bin_dir" "setup.sh"

  assert_not_contains "$call_log" "docker "
  assert_not_contains "$call_log" "supabase "
  assert_not_contains "$call_log" "command_that_must_not_run"
}

test_requires_app_package() {
  local tmp_dir repo bin_dir call_log
  tmp_dir="$(mktemp -d)"
  repo="$tmp_dir/repo"
  bin_dir="$tmp_dir/bin"
  call_log="$tmp_dir/calls.log"
  mkdir -p "$repo"
  touch "$call_log"
  git -C "$repo" init -q
  write_fake_commands "$bin_dir" "$call_log" "v22.12.0"

  if run_entrypoint "$repo" "$bin_dir" "setup.sh"; then
    fail "setup succeeded without app/package.json"
  fi

  assert_not_contains "$call_log" "node --version"
  assert_not_contains "$call_log" "npm "
}

test_setup_runs_dependencies_in_order
test_maintenance_runs_dependencies_in_order
test_rejects_unsupported_node_versions
test_does_not_start_external_services_or_source_env
test_requires_app_package

printf 'cloud scripts tests passed\n'

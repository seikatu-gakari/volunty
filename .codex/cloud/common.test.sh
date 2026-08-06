#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# shellcheck disable=SC1091
. "$script_dir/common.sh"

test_tmp="$(mktemp -d)"
trap 'rm -rf "$test_tmp"' EXIT

fake_bin="$test_tmp/bin"
mkdir -p "$fake_bin"

cat >"$fake_bin/npm" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$CODEX_CLOUD_TEST_NPM_LOG"
case "$*" in
  *"ctx7@0.5.7"*)
    cat >"$CODEX_CLOUD_TEST_BIN/ctx7" <<'CTX7'
#!/usr/bin/env bash
if [ "${1:-}" = "--version" ]; then
  printf '%s\n' "${CODEX_CLOUD_TEST_CTX7_VERSION:?}"
fi
CTX7
    chmod +x "$CODEX_CLOUD_TEST_BIN/ctx7"
    ;;
  *"vercel@58.7.1"*)
    cat >"$CODEX_CLOUD_TEST_BIN/vercel" <<'VERCEL'
#!/usr/bin/env bash
if [ "${1:-}" = "--version" ]; then
  printf '%s\n' "${CODEX_CLOUD_TEST_VERCEL_VERSION:?}"
fi
VERCEL
    chmod +x "$CODEX_CLOUD_TEST_BIN/vercel"
    ;;
esac
EOF
chmod +x "$fake_bin/npm"

codex_cloud_test_prepare_path() {
  PATH="$fake_bin:/usr/bin:/bin"
  export PATH
}

export CODEX_CLOUD_TEST_NPM_LOG="$test_tmp/npm.log"
export CODEX_CLOUD_TEST_BIN="$fake_bin"
export CODEX_CLOUD_TEST_CTX7_VERSION='0.5.7'
export CODEX_CLOUD_TEST_VERCEL_VERSION='58.7.1'
codex_cloud_test_prepare_path

codex_cloud_setup_context7_cli

expected='install --global --no-audit --no-fund ctx7@0.5.7'
actual="$(cat "$CODEX_CLOUD_TEST_NPM_LOG")"

if [ "$actual" != "$expected" ]; then
  printf 'unexpected npm invocation\nexpected: %s\nactual:   %s\n' "$expected" "$actual" >&2
  exit 1
fi

: >"$CODEX_CLOUD_TEST_NPM_LOG"
codex_cloud_setup_context7_cli

if [ -s "$CODEX_CLOUD_TEST_NPM_LOG" ]; then
  printf 'ctx7 is already current but npm was invoked again\n' >&2
  exit 1
fi

: >"$CODEX_CLOUD_TEST_NPM_LOG"
codex_cloud_setup_vercel_cli

expected='install --global --no-audit --no-fund vercel@58.7.1'
actual="$(cat "$CODEX_CLOUD_TEST_NPM_LOG")"

if [ "$actual" != "$expected" ]; then
  printf 'unexpected npm invocation\nexpected: %s\nactual:   %s\n' "$expected" "$actual" >&2
  exit 1
fi

: >"$CODEX_CLOUD_TEST_NPM_LOG"
codex_cloud_setup_vercel_cli

if [ -s "$CODEX_CLOUD_TEST_NPM_LOG" ]; then
  printf 'vercel is already current but npm was invoked again\n' >&2
  exit 1
fi

assert_no_mcpc_install() {
  if grep -Fq 'mcpc' "$CODEX_CLOUD_TEST_NPM_LOG"; then
    printf 'mcpc installation was requested by the Cloud CLI setup\n' >&2
    exit 1
  fi
}

assert_no_mcpc_install

write_existing_cli() {
  local command_name="$1"
  local version="$2"
  local destination_bin="${3:-$fake_bin}"
  cat >"$destination_bin/$command_name" <<EOF
#!/usr/bin/env bash
if [ "\${1:-}" = "--version" ]; then
  printf '%s\\n' '$version'
fi
EOF
  chmod +x "$destination_bin/$command_name"
}

test_reinstalls_mismatched_versions() {
  write_existing_cli ctx7 '0.5.6'
  write_existing_cli vercel '58.7.0'
  : >"$CODEX_CLOUD_TEST_NPM_LOG"

  codex_cloud_setup_context7_cli
  codex_cloud_setup_vercel_cli

  expected=$'install --global --no-audit --no-fund ctx7@0.5.7\ninstall --global --no-audit --no-fund vercel@58.7.1'
  actual="$(cat "$CODEX_CLOUD_TEST_NPM_LOG")"
  if [ "$actual" != "$expected" ]; then
    printf 'mismatched CLIs were not reinstalled\nexpected: %s\nactual:   %s\n' "$expected" "$actual" >&2
    exit 1
  fi

  [ "$(ctx7 --version)" = '0.5.7' ] || exit 1
  [ "$(vercel --version)" = '58.7.1' ] || exit 1
  assert_no_mcpc_install
}

test_rejects_wrong_post_install_version() {
  rm -f "$fake_bin/ctx7" "$fake_bin/vercel"
  export CODEX_CLOUD_TEST_CTX7_VERSION='0.5.6'
  export CODEX_CLOUD_TEST_VERCEL_VERSION='58.7.0'
  : >"$CODEX_CLOUD_TEST_NPM_LOG"

  if codex_cloud_setup_context7_cli; then
    printf 'ctx7 accepted an incorrect post-install version\n' >&2
    exit 1
  fi
  if codex_cloud_setup_vercel_cli; then
    printf 'vercel accepted an incorrect post-install version\n' >&2
    exit 1
  fi

  expected=$'install --global --no-audit --no-fund ctx7@0.5.7\ninstall --global --no-audit --no-fund vercel@58.7.1'
  actual="$(cat "$CODEX_CLOUD_TEST_NPM_LOG")"
  if [ "$actual" != "$expected" ]; then
    printf 'wrong post-install versions did not fail as expected\nexpected: %s\nactual:   %s\n' "$expected" "$actual" >&2
    exit 1
  fi
  assert_no_mcpc_install
}

test_reinstalls_mismatched_versions
test_rejects_wrong_post_install_version

test_missing_cli_is_not_satisfied_by_host_cli() {
  local host_cli_bin="$test_tmp/host-cli-bin"
  mkdir -p "$host_cli_bin"

  write_existing_cli ctx7 '0.5.7' "$host_cli_bin"
  write_existing_cli vercel '58.7.1' "$host_cli_bin"

  rm -f "$fake_bin/ctx7" "$fake_bin/vercel"
  export CODEX_CLOUD_TEST_CTX7_VERSION='0.5.7'
  export CODEX_CLOUD_TEST_VERCEL_VERSION='58.7.1'
  : >"$CODEX_CLOUD_TEST_NPM_LOG"

  (
    PATH="$host_cli_bin:$PATH"
    export PATH
    [ "$(command -v ctx7)" = "$host_cli_bin/ctx7" ]
    [ "$(command -v vercel)" = "$host_cli_bin/vercel" ]
    codex_cloud_test_prepare_path
    codex_cloud_setup_context7_cli
    codex_cloud_setup_vercel_cli
  )

  expected=$'install --global --no-audit --no-fund ctx7@0.5.7\ninstall --global --no-audit --no-fund vercel@58.7.1'
  actual="$(cat "$CODEX_CLOUD_TEST_NPM_LOG")"
  if [ "$actual" != "$expected" ]; then
    printf 'host CLI shadowed the missing fake CLI case\nexpected: %s\nactual:   %s\n' "$expected" "$actual" >&2
    exit 1
  fi
}

test_missing_cli_is_not_satisfied_by_host_cli

printf 'ok: Codex Cloud installs pinned Context7 and Vercel CLIs without mcpc\n'

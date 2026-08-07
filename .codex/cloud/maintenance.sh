#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"

if [ -z "$repo_root" ]; then
  printf '[codex-cloud] Git repository root を解決できません。\n' >&2
  exit 1
fi

# shellcheck disable=SC1091
. "$script_dir/common.sh"
codex_cloud_setup_dependencies "$repo_root"

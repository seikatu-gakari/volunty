# Codex Cloud リモート開発環境 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Volunty を Codex Cloud で設計・実装・検証し、feature ブランチから `main` 向け Pull Request を作成できるリモート開発環境を構築する。

**Architecture:** Codex Cloud は Node.js 22 の setup/maintenance script を使って依存関係と Prisma Client を準備し、Cloud 内で lint、UT、build を実行する。Pull Request 作成後は GitHub Actions がローカル Supabase と Playwright E2E を含む検証を行い、Vercel は feature ブランチへの push ごとに Preview をデプロイする。Codex Cloud は `main` をマージせず、マージは人間が行う。

**Tech Stack:** Bash、Node.js 22、npm、Prisma 7、Next.js 16、Vitest、Playwright、Supabase CLI、GitHub Actions、Vercel Preview

## Global Constraints

- 作業ブランチは `codex/<topic>` とし、Pull Request の base は `main` とする。
- Node.js は 22.12 以上の 22 系を使用する。
- Cloud setup/maintenance は `app/` で `npm ci --no-audit` と `npm run db:generate` を実行する。
- Cloud setup/maintenance は `.env.local` をコピーせず、Docker、Supabase local、開発サーバー、本番 migration を起動しない。
- feature ブランチへの push は Vercel Preview の自動デプロイ対象とする。
- Pull Request の CI は lint、UT、build、ローカル Supabase を使った E2E を実行する。
- 本番 DB URL、Supabase service role key、OAuth secret、Vercel tokenを Codex Cloud に登録しない。
- `main` の branch protection、required checks、人間によるマージを維持する。
- 既存の `.serena/project.yml` の変更はコミット対象に含めない。

## File Map

| ファイル | 役割 |
| --- | --- |
| `.codex/cloud/common.sh` | setup/maintenance 共通の Node.js 検証と npm/Prisma セットアップ関数 |
| `.codex/cloud/setup.sh` | Codex Cloud 初回コンテナのセットアップ entrypoint |
| `.codex/cloud/maintenance.sh` | キャッシュ済みコンテナ再開時の maintenance entrypoint |
| `.codex/cloud/cloud-scripts.test.sh` | Cloud script の呼び出し順序、Node.js制約、外部サービス非起動を検証 |
| `.github/scripts/prepare-e2e-env.sh` | Supabase CLI のローカル出力から `app/.env.local` を一時生成 |
| `.github/scripts/prepare-e2e-env.test.sh` | E2E環境ファイル生成の決定的な検証 |
| `.github/workflows/ci.yml` | main向けPRのquality/E2E必須チェック |
| `AGENTS.md` | Cloud作業、ブランチ、PR、テスト完了条件の指示 |
| `docs/branch-workflow.md` | Vercel Preview と main向けPRを反映したブランチ運用 |
| `docs/codex-cloud.md` | Cloud、GitHub、Vercel の設定手順と依頼テンプレート |

---

### Task 1: Codex Cloud setup / maintenance scripts

**Files:**
- Create: `.codex/cloud/common.sh`
- Create: `.codex/cloud/setup.sh`
- Create: `.codex/cloud/maintenance.sh`
- Test: `.codex/cloud/cloud-scripts.test.sh`

**Interfaces:**
- `common.sh` exports `codex_cloud_setup_dependencies(repo_root)`; setup と maintenance はこの関数だけを entrypoint から呼び出す。
- `setup.sh` と `maintenance.sh` はリポジトリルートを `git rev-parse --show-toplevel` から解決し、common関数の終了コードをそのまま返す。
- テストは一時リポジトリと fake `node`/`npm` を用い、実際の依存関係や `.env.local` に依存しない。

- [ ] **Step 1: 失敗するシェルテストを書く**

  `cloud-scripts.test.sh` に次のケースを実装する。

  - Node.js `v22.12.0` で setup を実行すると `npm ci --no-audit`、`npm run db:generate` の順に呼ばれる。
  - maintenance でも同じ2コマンドが呼ばれる。
  - Node.js `v20.19.0` と `v22.11.0` はエラー終了し、npmを呼ばない。
  - fake `docker`、fake `supabase`、fake `.env.local` が存在しても、それらを呼ばず・読み込まない。
  - `app/package.json` がない一時リポジトリは明確なエラーを出して終了する。

  テストの検証骨子は次の形式にする。

  ```bash
  assert_contains "$call_log" "npm ci --no-audit"
  assert_contains "$call_log" "npm run db:generate"
  assert_not_contains "$call_log" "docker"
  assert_not_contains "$call_log" "supabase"
  ```

- [ ] **Step 2: テストが期待どおり RED になることを確認する**

  ```bash
  bash .codex/cloud/cloud-scripts.test.sh
  ```

  Expected: `common.sh`、setup、maintenance がまだ存在しないため、セットアップ呼び出しの検証で失敗する。

- [ ] **Step 3: 共通セットアップ関数を実装する**

  `common.sh` は `set -euo pipefail` を有効にし、次の順序で処理する。

  ```bash
  require_node_22() {
    local version major minor
    version="$(node --version)"
    major="${version#v}"
    major="${major%%.*}"
    minor="${version#v*.}"
    minor="${minor%%.*}"
    if [ "$major" != "22" ] || [ "$minor" -lt 12 ]; then
      printf 'Node.js 22.12+ が必要です: %s\n' "$version" >&2
      return 1
    fi
  }

  codex_cloud_setup_dependencies() {
    local repo_root="$1"
    local app_dir="$repo_root/app"
    [ -f "$app_dir/package.json" ] || return 1
    require_node_22
    cd "$app_dir"
    npm ci --no-audit
    npm run db:generate
  }
  ```

  実装ではバージョン解析の入力を `v22.12.0` の形式に限定し、Node.js/npmが存在しない場合はコマンド名を含む日本語エラーを出す。

- [ ] **Step 4: setup と maintenance の entrypoint を実装する**

  両ファイルは `SCRIPT_DIR` を基準に `common.sh` を読み込み、次を実行する。

  ```bash
  repo_root="$(git rev-parse --show-toplevel)"
  # shellcheck source=common.sh
  . "$script_dir/common.sh"
  codex_cloud_setup_dependencies "$repo_root"
  ```

  setup/maintenance間で処理を複製せず、`bash .codex/cloud/setup.sh` と `bash .codex/cloud/maintenance.sh` のどちらからでも同じ結果になるようにする。

- [ ] **Step 5: テストを GREEN にして script を commit する**

  ```bash
  bash .codex/cloud/cloud-scripts.test.sh
  bash -n .codex/cloud/common.sh .codex/cloud/setup.sh .codex/cloud/maintenance.sh
  git add .codex/cloud
  git commit -m "feat: add Codex Cloud setup scripts"
  ```

  Expected: `cloud scripts tests passed`、bash syntax success。

### Task 2: Pull Request CI とローカル Supabase E2E

**Files:**
- Create: `.github/scripts/prepare-e2e-env.sh`
- Test: `.github/scripts/prepare-e2e-env.test.sh`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- `prepare-e2e-env.sh` は第1引数の status file（`supabase status -o env` の shell assignment ファイル）を読み、リポジトリの `app/.env.local` を生成する。
- 生成する変数は `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`DATABASE_URL`、`DIRECT_URL`、`E2E_AUTH_ENABLED=true`、`E2E_TEST_USER_PASSWORD=volunty-e2e-password` とする。
- CI は `pull_request` の `main` base のみを対象にし、quality job と e2e job を独立した required check にする。

- [ ] **Step 1: E2E環境生成の失敗テストを書く**

  fake status file に次の値を置き、生成ファイルの値と機密情報のログ非出力を検証する。

  ```bash
  API_URL="http://127.0.0.1:54321"
  ANON_KEY="local-anon-key"
  SERVICE_ROLE_KEY="local-service-role-key"
  DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  ```

  `prepare-e2e-env.test.sh` は `app/.env.local` の各キーを assert し、stdout/stderr に `local-service-role-key` が出ていないことを assert する。

- [ ] **Step 2: テストを実行して RED を確認する**

  ```bash
  bash .github/scripts/prepare-e2e-env.test.sh
  ```

  Expected: helper未実装のため生成ファイルが存在せず失敗する。

- [ ] **Step 3: E2E環境生成 helper を実装する**

  helper は `set -euo pipefail`、`mktemp`、`trap` を使い、status file を shell source した後、値の存在を検証して `app/.env.local` へ書き出す。statusの内容や生成した秘密値はログへ出さない。

  ```bash
  : "${API_URL:?Supabase API_URL is missing}"
  : "${ANON_KEY:?Supabase ANON_KEY is missing}"
  : "${SERVICE_ROLE_KEY:?Supabase SERVICE_ROLE_KEY is missing}"
  : "${DB_URL:?Supabase DB_URL is missing}"

  umask 077
  cat > "$repo_root/app/.env.local" <<EOF
  NEXT_PUBLIC_SUPABASE_URL=$API_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
  DATABASE_URL=$DB_URL
  DIRECT_URL=$DB_URL
  E2E_AUTH_ENABLED=true
  E2E_TEST_USER_PASSWORD=volunty-e2e-password
  EOF
  ```

- [ ] **Step 4: helperを GREEN にする**

  ```bash
  bash .github/scripts/prepare-e2e-env.test.sh
  bash -n .github/scripts/prepare-e2e-env.sh
  ```

  Expected: generated env assertions pass and secret value is not printed.

- [ ] **Step 5: quality job を追加する**

  `.github/workflows/ci.yml` に `pull_request` と `main` base filter、`ubuntu-latest`、`actions/checkout@v4`、`actions/setup-node@v4`（Node 22、`app/package-lock.json` cache）を追加する。quality job は次を独立 step として実行する。

  ```yaml
  - run: npm ci --no-audit
    working-directory: app
  - run: npm run db:generate
    working-directory: app
  - run: npm run lint
    working-directory: app
  - run: npm test
    working-directory: app
  - run: npm run build
    working-directory: app
  ```

- [ ] **Step 6: E2E job を追加する**

  E2E job は Node/npm、Supabase CLI、依存関係、Chromiumを準備し、次の順序で実行する。

  ```yaml
  - uses: supabase/setup-cli@v2
  - run: npm ci --no-audit
    working-directory: app
  - run: npx playwright install --with-deps chromium
    working-directory: app
  - run: supabase start
  - run: supabase status -o env > "$RUNNER_TEMP/supabase.env"
  - run: bash .github/scripts/prepare-e2e-env.sh "$RUNNER_TEMP/supabase.env"
  - run: supabase migration up --local
  - run: npm run test:e2e
    working-directory: app
  ```

  `if: always()` の artifact step で `app/playwright-report`、`app/test-results` を `actions/upload-artifact@v4` に保存し、最後に `supabase stop --no-backup` を実行する。actionのmajor versionは実装時に公式 actionの現行安定版を確認して固定する。

- [ ] **Step 7: CI構文を検証して commit する**

  ```bash
  bash .github/scripts/prepare-e2e-env.test.sh
  bash -n .github/scripts/prepare-e2e-env.sh
  actionlint .github/workflows/ci.yml
  git add .github/scripts .github/workflows/ci.yml
  git commit -m "ci: add main pull request checks"
  ```

  `actionlint` が利用できない場合は、YAML parserで構文を確認し、最終報告に未実行理由を記載する。

### Task 3: Cloud運用指示とブランチ運用ドキュメント

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/branch-workflow.md`
- Create: `docs/codex-cloud.md`

**Interfaces:**
- AGENTS.md はリポジトリ全体に適用される短い制約だけを持ち、詳細手順は `docs/codex-cloud.md` に置く。
- branch-workflow.md は現行Vercel設定を記録し、`codex/<topic> → main` のPRを標準フローとする。
- codex-cloud.md はCloud/GitHub/Vercelの画面設定と依頼テンプレートを一つの入口にする。

- [ ] **Step 1: ドキュメント更新内容を先に検証する**

  既存文書の `preview` 中継、feature pushのデプロイ記述、main直接push禁止の箇所を `rg` で列挙し、既存の本番DB migration説明を削除しないことを確認する。

  ```bash
  rg -n "preview|main|Vercel|直接push|Production DB Migration" AGENTS.md docs/branch-workflow.md
  ```

- [ ] **Step 2: AGENTS.md を更新する**

  次の短いルールを運用ルールへ追加する。

  - 作業ブランチは `codex/<topic>`、Pull Requestのbaseは `main`。
  - feature pushのVercel Previewを確認してからPRを完成扱いにする。
  - Codex Cloudは `main` へ直接pushせず、マージは人間が行う。
  - CI必須チェックと `volunty-test-completion-gate` の結果をPR本文へ記載する。

- [ ] **Step 3: branch-workflow.md を現行設定へ修正する**

  `feature/*` と `codex/*` のpushでVercel Previewが作成されること、PRのbaseを `main` とすること、main mergeでProductionへデプロイされることを表と手順へ反映する。`preview` ブランチは既存利用者向けの説明として残す場合も、標準フローの必須中継地点として記載しない。

- [ ] **Step 4: codex-cloud.md を作成する**

  次の章を日本語で記載する。

  1. Cloud Environment作成（repository、Node.js 22、setup、maintenance）
  2. Agent internet accessの最小設定
  3. 登録可能な非秘密環境変数と登録禁止の本番secret
  4. GitHubのmain branch protectionとrequired checks
  5. Codex Code Review / Automatic reviews
  6. Vercel Previewの確認（feature pushをIgnored Build Stepで除外しない）
  7. Cloud依頼テンプレート
  8. CI失敗時の同じPRブランチへの修正手順

  依頼テンプレートは次を含める。

  ```text
  Issue #123を対応してください。
  まず設計案を提示し、承認されるまで実装しないでください。
  実装計画の承認後、codex/cloud-setup ブランチで実装してください。
  必要なUT/E2Eを追加・実行し、Vercel Previewを確認したうえでmain向けPRを作成してください。
  mainへのマージは行わないでください。
  ```

- [ ] **Step 5: ドキュメントを検証して commit する**

  ```bash
  git diff --check
  rg -n "codex/<topic>|main向け|Preview|mainへの直接push|マージは人間" AGENTS.md docs/branch-workflow.md docs/codex-cloud.md
  git add AGENTS.md docs/branch-workflow.md docs/codex-cloud.md
  git commit -m "docs: document Codex Cloud workflow"
  ```

### Task 4: リモート設定と最終検証

**Files:**
- Verify: `.codex/environments/default.toml`（ローカルCodex App用として保持）
- Verify: `.codex/cloud/setup.sh`
- Verify: `.codex/cloud/maintenance.sh`
- Verify: `.github/workflows/ci.yml`
- Verify: `docs/codex-cloud.md`

**Interfaces:**
- Codex Cloud Environment設定はリポジトリ内ファイルではなく、Codex設定画面へ登録する。
- GitHub branch protection、Codex Code Review、Vercel Git設定は外部サービス側の設定であり、production secretの値は取得・表示しない。

- [ ] **Step 1: Cloud Environmentを登録する**

  Codex設定画面で repository `seikatu-gakari/volunty` を選び、Node.js 22、次のsetup/maintenanceを登録する。

  ```text
  Setup: bash .codex/cloud/setup.sh
  Maintenance: bash .codex/cloud/maintenance.sh
  ```

  Agent internet accessはoffを基本にし、必要時だけ依存関係用のGET/HEAD/OPTIONSに限定する。本番secretは登録しない。

- [ ] **Step 2: GitHub settingsを確認する**

  `main` にPull Request必須、required checks、force push禁止、branch deletion禁止、未解決review禁止を設定する。Codex Code ReviewとAutomatic reviewsを有効化する。自動マージは無効のままにする。

- [ ] **Step 3: Vercel settingsを確認する**

  feature/codexブランチのpushがPreviewデプロイ対象であることを確認する。Ignored Build Stepにmain/preview以外をskipする条件が残っている場合は、現在のVercel設定と矛盾するため、変更前にユーザーへ確認する。

- [ ] **Step 4: ローカルで設定資産を検証する**

  ```bash
  bash .codex/cloud/cloud-scripts.test.sh
  bash .github/scripts/prepare-e2e-env.test.sh
  bash -n .codex/cloud/common.sh .codex/cloud/setup.sh .codex/cloud/maintenance.sh
  bash -n .github/scripts/prepare-e2e-env.sh
  cd app && npm run lint
  cd app && npm test
  cd app && npm run build
  ```

- [ ] **Step 5: E2Eを実行する**

  Docker、Supabase CLI、`.env.local` が利用できる場合だけ、プロジェクトルートで次を実行する。

  ```bash
  make e2e
  ```

  実行できない場合は、コマンド、失敗理由、CIでの実行状態を最終報告に分けて記載し、E2E成功を確認するまで完了宣言しない。

- [ ] **Step 6: Cloudから検証PRを作成する**

  小さな変更または設定ブランチで、Cloudが `codex/<topic>` をpushし、Vercel Previewを作成し、`main` 向けPRを作成することを確認する。CI/Codex Reviewが起動し、Cloudが `main` をマージできないことを確認する。

- [ ] **Step 7: 最終状態を記録する**

  ```bash
  git status --short
  git diff main...HEAD --stat
  git log --oneline --decorate -8
  ```

  `.serena/project.yml` の既存変更を除き、設定資産、テスト、ドキュメントだけが意図したコミットに含まれることを確認する。

## Test Completion Gate

| 区分 | 判定 | 追加・更新するテスト | 最終結果 |
| --- | --- | --- | --- |
| UT | 必須相当 | `.codex/cloud/cloud-scripts.test.sh`、`.github/scripts/prepare-e2e-env.test.sh`（決定的なShell設定ロジック） | Task 1/2 と最終検証で実行 |
| E2E | 必須 | 既存 `make e2e` を GitHub Actions の `ci.yml` で実行（アプリのユーザーフロー変更は行わない） | CI成功を確認するまで未完了 |

ドキュメントのみの Task 3 はUT/E2E適用外だが、最終的なCloud運用変更がPR作成とCIに影響するため、Task 4で実際の設定資産とCIを検証する。

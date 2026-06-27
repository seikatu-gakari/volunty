# E2E Playwright スモークスイート実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `make e2e` だけでローカル Supabase、E2E seed、Next.js dev server、13本のPlaywrightスモーク、HTMLレポートを直列実行できるようにする。

**Architecture:** Playwright の `globalSetup` は `npm run seed:e2e` を子プロセス実行し、`webServer` が Next.js を起動する。setup project が6ペルソナの `storageState` を生成し、chromium project が4つのspecを1 workerで実行する。O3用の応募済み案件とP3用の未応募案件は分離し、seedのたびに副作用を初期状態へ戻す。

**Tech Stack:** Next.js 16、TypeScript 5 strict、Prisma 7、Supabase、Vitest 2、`@playwright/test`

## Global Constraints

- 対象はローカル Supabase のみとし、本番・Vercel Preview の環境変数は変更しない。
- `/api/test-auth/login` の二重ガードは変更しない。
- E2E seed から `server-only` を含むモジュールをPlaywrightへ直接importせず、必ず子プロセスで実行する。
- storageState、HTMLレポート、テスト成果物はGit管理対象外にする。
- Playwrightは `workers: 1`、`fullyParallel: false` で副作用を直列化する。
- ユーザー依頼にcommitは含まれないため、この計画ではcommitを作成しない。

---

### Task 1: ペルソナと冪等E2E seed

**Files:**
- Modify: `app/src/lib/test-auth/personas.ts`
- Modify: `app/scripts/seed-e2e.test.ts`
- Modify: `app/scripts/seed-e2e.ts`

**Interfaces:**
- Produces: `PersonaKey` に `participant-suspendable` と `organization-pending` を追加する。
- Produces: `seedE2eUsers(): Promise<void>` が6ユーザー、参加者プロフィール、診断結果、2件の固定募集、O3用応募、審査待ち団体を作成し、P3/A2/A3/O3の副作用を毎回初期化する。

- [x] `seed-e2e.test.ts` のPrisma mockへ `participantProfile.upsert`、`personalityType.findUnique`、`diagnosisResult.findFirst/create`、`organizationProfile.upsert`、`opportunity.findFirst/create/update`、`matchingCandidate.deleteMany/upsert`、`user.update` を追加する。
- [x] 6ペルソナのIDが保持され、プロフィール・診断・団体・2案件・応募リセット・凍結リセットが呼ばれる失敗テストを追加する。
- [x] `cd app && npx vitest run scripts/seed-e2e.test.ts src/lib/test-auth/personas.test.ts` を実行し、追加仕様が未実装のためFAILすることを確認する。
- [x] `personas.ts` と `seed-e2e.ts` に最小実装を追加する。P3用固定案件の既存応募は `deleteMany`、O3用固定案件の応募は `upsert(... status: "applied")` で戻す。
- [x] 同じコマンドを再実行し、対象テストがPASSすることを確認する。

### Task 2: Playwrightランナー基盤

**Files:**
- Modify: `app/package.json`
- Modify: `app/package-lock.json`
- Create: `app/playwright.config.ts`
- Create: `app/e2e/global-setup.ts`
- Create: `app/e2e/auth.setup.ts`

**Interfaces:**
- Produces: `npm run test:e2e`、`npm run test:e2e:ui`、`npm run test:e2e:report`。
- Produces: `playwright/.auth/{participant,participant-fresh,participant-suspendable,organization,organization-pending,admin}.json`。

- [x] `cd app && npm install --save-dev @playwright/test` で依存とlockfileを更新する。
- [x] configへHTML/list reporter、global setup、setup/chromium projects、localhost:3000 webServerを定義する。
- [x] global setupで `.auth` ディレクトリを作り、appをcwdとして `npm run seed:e2e` を同期子プロセス実行する。
- [x] auth setupで `/api/test-auth/login?persona=<key>` を開き、6つのstorageStateを保存する。
- [x] `cd app && npx playwright test --list` を実行し、setup 6本とsmoke 13本が列挙可能な状態を確認する（spec追加前はsetup 6本のみでよい）。

### Task 3: ガード・参加者スモーク

**Files:**
- Create: `app/e2e/guards.spec.ts`
- Create: `app/e2e/participant.spec.ts`

**Interfaces:**
- Consumes: Task 2のparticipant系storageState。
- Produces: G1-G3、P1-P4の7ケース。

- [x] G1は未認証トップの「ログイン」リンク、G2は `/dashboard` から `/login`、G3は参加者で `/admin` から `/forbidden` を検証する。
- [x] P1はfresh personaで `/onboarding/role`、P2はおすすめ一覧の `E2E 応募対象案件`、P3はその詳細から応募してマイページ反映、P4はプロフィールと応募一覧を検証する。
- [x] `cd app && npx playwright test --list e2e/guards.spec.ts e2e/participant.spec.ts` で7ケースを確認する。

### Task 4: 団体・管理者スモーク

**Files:**
- Create: `app/e2e/organization.spec.ts`
- Create: `app/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: Task 2のorganization/admin storageStateとTask 1の固定seed。
- Produces: O1-O3、A1-A3の6ケース。

- [x] O1は `E2E 団体フロー案件`、O2は一意タイトルの募集作成、O3はseed済み応募の承認を検証する。
- [x] A1は管理ダッシュボード統計、A2は `E2E審査待ち団体` の承認と承認済みタブ反映、A3はsuspendableユーザーを検索して凍結・解除する。
- [x] `cd app && npx playwright test --list` でsetup 6本とsmoke 13本を確認する。

### Task 5: 開発コマンドと成果物除外

**Files:**
- Modify: `Makefile`
- Modify: `app/.gitignore`

**Interfaces:**
- Produces: `make e2e`、`make e2e-ui`、`make e2e-report`。

- [x] `.PHONY` と3ターゲットを仕様どおり追加し、`.env.local` をexportしてPlaywrightを起動する。
- [x] `playwright/.auth/`、`playwright-report/`、`test-results/`、`.last-run.json` をignoreする。
- [x] `make help | rg 'e2e'` と `git check-ignore` でターゲットと除外を確認する。

### Task 6: 受け入れ検証

**Files:**
- Verify only

- [x] `cd app && npm run lint` を実行する。
- [x] `cd app && npx tsc --noEmit` を実行する。
- [x] `cd app && npm test -- --reporter=dot` で既存347件を含む全テストを実行する。
- [x] `make e2e` を2回連続で実行し、各回setup 6本とsmoke 13本が成功することを確認する。
- [x] `npx playwright install chromium` が未実施でブラウザ不足になった場合だけインストールし、同じ検証を再実行する。
- [x] `git diff --check` と差分レビューで秘密情報、storageState、レポートが含まれないことを確認する。

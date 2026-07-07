# E2E スモークスイート（@playwright/test）+ `make e2e` 自動実行 — 実装仕様

> **注意（2026-07-06 更新）**: 本書は導入時の実装計画であり、コード例の一部（`diagnosisType`/`diagnosisScores`/`personalityType`/
> 旧・独自16問モード等）は診断・マッチング再設計により旧仕様です。現行の正は `app/scripts/seed-e2e.ts` と
> `app/e2e/*.spec.ts` を参照してください
> （現行: IPIP-BFM-50 簡易15問/全50問の2モード・`latest_diagnosis_result_id` 参照）。


> **位置づけ**: 本仕様は [`e2e-auth-bypass.md`](./e2e-auth-bypass.md) の「将来拡張」（`@playwright/test` 導入 + `globalSetup` + `storageState` + プロフィール seed）を実装するもの。
> **目的**: 現在の主要機能をフロー単位でカバーする E2E スモークスイートを構築し、`make e2e` 一発で `Supabase 起動 → seed → dev サーバー自動起動 → テスト実行 → HTML レポート` まで無人実行できるようにする。
> **対象環境**: ローカル Supabase のみ（本番・Vercel Preview への影響ゼロを維持する）。
> **実装者**: codex（本仕様だけで単独実装できることを目標とする）。

> **2026-07-01 参加者E2E拡張**: 参加者シナリオは
> [`docs/superpowers/specs/2026-07-01-participant-e2e-design.md`](../docs/superpowers/specs/2026-07-01-participant-e2e-design.md)
> を最新仕様とする。従来の `participant.spec.ts` は機能領域別の5ファイルへ分割され、
> P-2〜P-14とアカウント削除を検証する。以下は初期スモーク導入時の設計記録として残す。

> **2026-07-05 団体E2E拡張**: 団体シナリオ O-E1〜O-E10 は
> [`docs/superpowers/specs/2026-07-05-organization-e2e-design.md`](../docs/superpowers/specs/2026-07-05-organization-e2e-design.md)
> を最新仕様とする。既存 O1〜O3 を維持し、オンボーディング系と業務ライフサイクル系へ拡張した。

| ID | Playwright spec |
| --- | --- |
| O-E1〜O-E3 | `app/e2e/organization-onboarding.spec.ts` |
| O-E4〜O-E10 | `app/e2e/organization-lifecycle.spec.ts` |

---

## 1. 前提と既存資産

### 流用する（再実装しない）

| 資産 | パス | 役割 |
|------|------|------|
| テスト認証ルート | `app/src/app/api/test-auth/login/route.ts` | `GET ?persona=X&next=/path` で OAuth を回避してログイン → リダイレクト。二重ガード済み |
| ペルソナ定義 | `app/src/lib/test-auth/personas.ts` | `PERSONAS` / `resolvePersona()`。`import "server-only"` 付き |
| E2E seed | `app/scripts/seed-e2e.ts` | `seedE2eUsers()` を export。Auth + `m_user` を冪等 upsert。`npm run seed:e2e` |
| マスタ seed | `app/prisma/seed.ts` | 10 類型マスタ＋固定 UUID 団体 4＋募集 8 件（`make db-seed`） |
| 環境変数 | `app/.env.local` | `E2E_AUTH_ENABLED=true` / `E2E_TEST_USER_PASSWORD=...`（ローカル限定・コミット済み） |
| Makefile | `Makefile` | env 流し込みパターン `@set -a; . ./app/.env.local 2>/dev/null; set +a; <cmd>` |

### 現状 seed の限界（本仕様で解消する）

`scripts/seed-e2e.ts` は現状 **4 ペルソナの Auth ユーザー＋`m_user` レコードしか作っていない**。
`ParticipantProfile` / `DiagnosisResult` / `OrganizationProfile` / `Opportunity` / `MatchingCandidate` が無いため、
そのままでは `/recommendations`・`/dashboard`・応募者一覧・`/admin/reviews` のスモークが成立しない。
→ **`seed-e2e.ts` に前提データ生成を追加する**（後述 §4.3）。

---

## 2. 設計方針

```
make e2e
  │  ① supabase start（冪等。既起動ならスキップ）
  ▼
npx playwright test
  │  ② globalSetup: execSync("npm run seed:e2e")  ← 子プロセスで実行（server-only 回避）
  │       └─ Auth/m_user + Profile/Diagnosis/Opportunity/Application/審査待ち団体 を冪等投入
  │  ③ webServer: npm run dev を自動起動（.env.local を Next.js が自動読込 → E2E_AUTH_ENABLED 有効）
  │  ④ project "setup"（auth.setup.ts）:
  │       各ペルソナで /api/test-auth/login に goto → storageState を保存
  │  ▼
  │  ⑤ project "chromium"（*.spec.ts、depends on setup）:
  │       storageState を読み込んで認証済み状態で各フローを検証
  ▼
HTML レポート（playwright-report/）
```

**server-only の落とし穴（最重要）**: `personas.ts` は `import "server-only"` 済み。
Playwright の Node ランタイムから `seedE2eUsers` を **直接 import するとクラッシュする**。
seed は必ず **子プロセスで `npm run seed:e2e` を spawn** して実行する（§4.5）。

---

## 3. 実装対象ファイル一覧

### 新規作成
```
app/playwright.config.ts                 # Playwright 設定（webServer / globalSetup / projects）
app/e2e/global-setup.ts                  # seed を子プロセス実行
app/e2e/auth.setup.ts                    # ペルソナ別 storageState 生成（project "setup"）
app/e2e/guards.spec.ts                   # 未認証・ロール越境（G1–G3）
app/e2e/participant.spec.ts              # 参加者フロー（P1–P5）
app/e2e/organization.spec.ts             # 団体フロー（O1–O3）
app/e2e/admin.spec.ts                    # 管理者フロー（A1–A3）
```

### 変更
```
app/package.json                         # @playwright/test 追加 + scripts
app/src/lib/test-auth/personas.ts        # ペルソナ追加（organization-pending / participant-suspendable）
app/scripts/seed-e2e.ts                  # 前提データ生成 + dotenv(.env.local) 読込 + 冪等リセット
app/.gitignore                           # storageState / レポート除外
Makefile                                 # e2e / e2e-ui / e2e-report ターゲット
```

---

## 4. 各ファイルの実装詳細

### 4.1 依存追加（`app/`）

```bash
cd app
npm i -D @playwright/test
npx playwright install chromium
```

`app/package.json` の `scripts` に追加:
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:report": "playwright show-report"
```

### 4.2 `app/src/lib/test-auth/personas.ts` — ペルソナ追加

`PersonaKey` の union と `PERSONAS` に 2 件追加する:

```typescript
export type PersonaKey =
  | "participant-fresh"
  | "participant-onboarded"
  | "participant-suspendable" // ← 追加: admin の凍結→解除テスト専用の使い捨て
  | "organization-approved"
  | "organization-pending"    // ← 追加: admin の審査承認テスト用
  | "admin";

// PERSONAS に追加
"participant-suspendable": {
  key: "participant-suspendable",
  email: "e2e-participant-suspendable@example.com",
  role: "participant",
  description: "admin の凍結/解除フロー専用（毎回 isActive=true に戻す）",
},
"organization-pending": {
  key: "organization-pending",
  email: "e2e-org-pending@example.com",
  role: "organization",
  description: "審査待ち団体（毎回 reviewStatus=pending に戻す）",
},
```

> `seed-e2e.ts` の `buildUserMetadata()` は `participant-fresh` 以外に `role` / `onboarding_completed=true` を付与する。追加 2 ペルソナもこの規則に従う（変更不要）。
> 既存のユニットテスト `personas.test.ts` は `Object.keys(PERSONAS)` を走査するため、追加ペルソナでも自動的に通る。

### 4.3 `app/scripts/seed-e2e.ts` — 前提データ生成（最重要）

`seedE2eUsers()` 内、Auth/`m_user` upsert ループの**後**に、ペルソナへ紐づく状態データを冪等に投入する。
スキーマは `app/prisma/schema.prisma` 準拠（フィールド名は以下の通り）。

> **DRY 原則**: emailからユーザーIDを引くため、ループ中に `idByEmail: Map<string,string>` を構築しておき後段で再利用する。

#### (a) `participant-onboarded`: プロフィール＋診断結果
```typescript
// 人物タイプを 1 件取得（DiagnosisResult.personalityTypeId は m_personality_type.id を指す）
const ptype = await prisma.personalityType.findUnique({ where: { typeId: "supporter-care" } });

await prisma.participantProfile.upsert({
  where: { userId: onboardedId },
  update: { region: "東京都", publicProfile: true, diagnosisType: "supporter-care",
            diagnosisScores: big5, diagnosisMode: "brief" },
  create: { userId: onboardedId, name: "E2E 参加者(診断済)", birthday: new Date("1995-04-01"),
            region: "東京都", publicProfile: true, diagnosisType: "supporter-care",
            diagnosisScores: big5, diagnosisMode: "brief" },
});

// big5 = { extraversion: 65, agreeableness: 82, conscientiousness: 60, neuroticism: 35, openness: 55 }
// DiagnosisResult は @@unique が無いので findFirst → 無ければ create（冪等）
const existingDiag = await prisma.diagnosisResult.findFirst({ where: { userId: onboardedId } });
if (!existingDiag) {
  await prisma.diagnosisResult.create({
    data: { userId: onboardedId, personalityTypeId: ptype?.id ?? null,
            big5Scores: big5, diagnosisMode: "brief" },
  });
}
```

#### (b) `organization-approved`: 承認済み団体＋自団体募集＋応募
```typescript
const orgProfile = await prisma.organizationProfile.upsert({
  where: { userId: orgApprovedId },
  update: { reviewStatus: "approved", verified: true, profileCompleteness: 100 },
  create: { userId: orgApprovedId, organizationName: "E2E承認済み団体",
            reviewStatus: "approved", verified: true, profileCompleteness: 100,
            activityAreas: ["東京都"], activityCategories: ["地域活性化"] },
});

const opp = await prisma.opportunity.upsert({
  // Opportunity に複合 unique は無いため findFirst → create/update で代用してもよい。
  // ここでは固定タイトルで findFirst → 無ければ create する実装にする。
  // status: "published", publishedAt: now, requirementTraits を設定
});

// participant-onboarded → opp への応募（@@unique([participantId, opportunityId]) で冪等）
await prisma.matchingCandidate.upsert({
  where: { participantId_opportunityId: { participantId: onboardedId, opportunityId: opp.id } },
  update: { status: "applied", appliedAt: new Date() }, // ← O3 のため毎回 applied に戻す
  create: { participantId: onboardedId, opportunityId: opp.id, matchScore: 80,
            status: "applied", appliedAt: new Date(), message: "E2E 応募メッセージ" },
});
```

#### (c) `organization-pending`: 審査待ち団体（毎回 pending にリセット）
```typescript
await prisma.organizationProfile.upsert({
  where: { userId: orgPendingId },
  update: { reviewStatus: "pending", verified: false, reviewedAt: null, reviewedBy: null }, // A2 巻き戻し
  create: { userId: orgPendingId, organizationName: "E2E審査待ち団体",
            reviewStatus: "pending", verified: false, profileCompleteness: 80,
            activityAreas: ["神奈川県"], activityCategories: ["子ども支援"] },
});
```

#### (d) 冪等リセット（テスト副作用の巻き戻し）
スモークは破壊的操作（凍結・承認・応募ステータス変更）を含むため、`seedE2eUsers()` は毎回これらを初期状態へ戻す:
```typescript
// A3（凍結→解除）の巻き戻し: suspendable を毎回 active に
await prisma.user.update({
  where: { id: suspendableId },
  data: { isActive: true, suspendedAt: null, suspendReason: null, suspendedBy: null },
});
// (c) で organization-pending を pending に / (b) で MatchingCandidate を applied に戻す（上記 upsert で対応済み）
```

> `idByEmail` の各 ID は、ループ中に `usersByEmail`／upsert 結果から取得して保持しておく。

#### (e) dotenv 読込（`npm run seed:e2e` 単体実行対応）
`seed-e2e.ts` 先頭に追加（`.env.local` から `E2E_TEST_USER_PASSWORD` / `DATABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を読む）:
```typescript
import { config } from "dotenv";
import { resolve as resolvePath } from "node:path";
config({ path: resolvePath(process.cwd(), ".env.local") });
```
> `dotenv` は既に devDependencies にある。`prisma/seed.ts` は `import "dotenv/config"` で同等のことをしている。

### 4.4 `app/playwright.config.ts`（新規）

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,            // seed 副作用を共有するため直列
  workers: 1,
  reporter: [["html"], ["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### 4.5 `app/e2e/global-setup.ts`（新規）

```typescript
import { execSync } from "node:child_process";
import { resolve } from "node:path";

// server-only を含む seed を Node から直接 import するとクラッシュするため子プロセスで実行する
export default async function globalSetup() {
  execSync("npm run seed:e2e", {
    cwd: resolve(__dirname, ".."), // app/
    stdio: "inherit",
  });
}
```

### 4.6 `app/e2e/auth.setup.ts`（新規・project "setup"）

```typescript
import { test as setup } from "@playwright/test";

const personas: { key: string; file: string }[] = [
  { key: "participant-onboarded",    file: "participant" },
  { key: "participant-fresh",        file: "participant-fresh" },
  { key: "participant-suspendable",  file: "participant-suspendable" },
  { key: "organization-approved",    file: "organization" },
  { key: "organization-pending",     file: "organization-pending" },
  { key: "admin",                    file: "admin" },
];

for (const p of personas) {
  setup(`authenticate as ${p.key}`, async ({ page }) => {
    await page.goto(`/api/test-auth/login?persona=${p.key}`);
    await page.waitForURL("**/*"); // リダイレクト完了待ち
    await page.context().storageState({ path: `playwright/.auth/${p.file}.json` });
  });
}
```

### 4.7 テスト spec（`app/e2e/*.spec.ts`）

各ファイル冒頭で `test.use({ storageState })` を指定。セレクタは堅牢性のため `getByRole` / `getByText`（日本語ラベル）を優先する。実画面のラベル・遷移は実装時に Playwright MCP（`browser_snapshot`）で確認しながら確定する。

**guards.spec.ts**
- G1: 未認証で `/` → ランディング表示（ログイン導線リンクの存在を確認）
- G2: 未認証で `/dashboard` → `/login` にリダイレクト（`await expect(page).toHaveURL(/\/login/)`）
- G3: `storageState: participant.json` で `/admin` → `/forbidden`

**participant.spec.ts**（`storageState: participant.json` 基本、P1 のみ fresh）
- P1: `participant-fresh.json` で `/onboarding/role` に到達（オンボーディング未完了）
- P2: `/recommendations` でおすすめ案件カードが 1 件以上表示される
- P3: 案件詳細 → 応募 → 成功表示、`/mypage` に応募が反映される
- P4: `/mypage` でプロフィール・応募一覧が表示される
- P5（任意）: `/diagnosis` 簡易 16 問を回答 → `/diagnosis/result` に結果表示（XState UI のため実装時にセレクタ確認）

**organization.spec.ts**（`storageState: organization.json`）
- O1: `/dashboard` に自団体の募集案件が表示される
- O2: `/dashboard/opportunities/new` で募集作成 → 一覧に反映（タイトルは衝突回避のため `E2E-${Date.now()}`）
- O3: 応募者一覧（`/dashboard/opportunities/[id]`）→ 承認 or 辞退でステータスが更新される

**admin.spec.ts**（`storageState: admin.json`）
- A1: `/admin` ダッシュボード（統計）表示
- A2: `/admin/reviews` で `organization-pending` を承認 → 一覧/履歴へ反映
- A3: `/admin/users` で `participant-suspendable` を凍結 → 解除（seed が次回 active に戻す）

---

### 4.8 `Makefile` — E2E ターゲット追加

`.PHONY` 行に `e2e e2e-ui e2e-report` を追加し、以下を追記（既存の env 流し込みパターンを踏襲）:

```makefile
e2e: ## E2Eスモークをフルオート実行（supabase→seed→dev自動起動→test→HTMLレポート）
	@echo "Supabase ローカル環境を起動中..."
	@set -a; . ./app/.env.local 2>/dev/null; set +a; supabase start >/dev/null 2>&1 || true
	cd $(APP_DIR) && set -a; . ./.env.local 2>/dev/null; set +a; npx playwright test

e2e-ui: ## Playwright UIモードで起動（デバッグ用）
	cd $(APP_DIR) && set -a; . ./.env.local 2>/dev/null; set +a; npx playwright test --ui

e2e-report: ## 直近のHTMLレポートを表示
	cd $(APP_DIR) && npx playwright show-report
```

> seed は `globalSetup` が担うため `make e2e` では呼ばない（`npx playwright test` 単体でも完結）。dev サーバーは `webServer` が自動起動・自動終了する。

### 4.9 `app/.gitignore` 追加

```
playwright/.auth/
playwright-report/
test-results/
.last-run.json
```

---

## 5. テストケース一覧（スモーク 13 本）

| ID | ロール / storageState | 操作 | 期待 |
|----|----------------------|------|------|
| G1 | 未認証 | `/` 表示 | ランディング＋ログイン導線 |
| G2 | 未認証 | `/dashboard` | `/login` へリダイレクト |
| G3 | participant | `/admin` | `/forbidden` |
| P1 | participant-fresh | ログイン後遷移 | `/onboarding/role` |
| P2 | participant-onboarded | `/recommendations` | おすすめ案件 1 件以上 |
| P3 | participant-onboarded | 案件詳細→応募 | 成功表示／`/mypage` に反映 |
| P4 | participant-onboarded | `/mypage` | プロフィール・応募一覧 |
| P5（任意）| participant-onboarded | `/diagnosis` 回答 | `/diagnosis/result` |
| O1 | organization-approved | `/dashboard` | 自団体案件表示 |
| O2 | organization-approved | 募集作成 | 一覧に反映 |
| O3 | organization-approved | 応募者承認/辞退 | ステータス更新 |
| A1 | admin | `/admin` | 統計表示 |
| A2 | admin | `/admin/reviews` 承認 | pending 団体が承認済みに |
| A3 | admin | `/admin/users` 凍結→解除 | isActive トグル |

---

## 6. ローカル実行手順

```bash
# 前提: app/.env.local に E2E_AUTH_ENABLED=true / E2E_TEST_USER_PASSWORD=... が設定済み（既存）
make e2e            # フルオート（推奨）

# 個別に動かす場合
make supabase-start
cd app && npm run seed:e2e        # 前提データ投入のみ
cd app && npx playwright test     # dev は webServer が自動起動
make e2e-report                   # 失敗時のスクショ・トレース確認
```

---

## 7. 受け入れ条件（検証）

- [ ] `make e2e` 一発で Supabase 起動 → seed → dev 自動起動 → 13 ケース実行 → 全緑。
- [ ] `make e2e` を **2 回連続**で実行し、凍結/承認/応募の副作用が冪等に巻き戻り 2 回目も全緑（再実行性）。
- [ ] `cd app && npx vitest run` で既存ユニット/統合テスト（347 件）が依然グリーン（`personas.ts` / `seed-e2e.ts` 変更の影響確認）。
- [ ] `personas.test.ts` が追加 2 ペルソナを含めて通る。
- [ ] 失敗時に `make e2e-report` で HTML レポート（スクショ・トレース）が開ける。

---

## 8. セキュリティ要件（厳守）

| ガード | 内容 |
|--------|------|
| 二重ガード維持 | `/api/test-auth/login` の `NODE_ENV!=="production"` && `E2E_AUTH_ENABLED==="true"` を変更しない |
| Vercel 非設定 | `E2E_AUTH_ENABLED` / `E2E_TEST_USER_PASSWORD` を Vercel（本番・Preview）環境変数に**追加しない** |
| storageState 除外 | `playwright/.auth/*.json` は `.gitignore` でコミットしない |
| ペルソナ隔離 | E2E ペルソナは `@example.com` ドメイン。本番ユーザーと衝突しない |

---

## 9. 実装チェックリスト（codex 完了条件）

- [ ] `npm i -D @playwright/test` + `npx playwright install chromium`
- [ ] `app/package.json` に `test:e2e` / `test:e2e:ui` / `test:e2e:report` 追加
- [ ] `personas.ts` に `organization-pending` / `participant-suspendable` 追加
- [ ] `seed-e2e.ts`: dotenv(.env.local) 読込 + (a)〜(e) の前提データ生成・冪等リセット実装
- [ ] `playwright.config.ts` 作成（webServer / globalSetup / projects）
- [ ] `e2e/global-setup.ts`（子プロセス seed）作成
- [ ] `e2e/auth.setup.ts`（6 ペルソナ storageState）作成
- [ ] `e2e/{guards,participant,organization,admin}.spec.ts` 作成（13 ケース）
- [ ] `Makefile` に `e2e` / `e2e-ui` / `e2e-report` 追加
- [ ] `app/.gitignore` 更新
- [ ] `make e2e` で全緑、2 回連続実行でも全緑
- [ ] `npx vitest run` 全緑（既存テスト非破壊）

---

## 10. スコープ外（次フェーズ）

- CI（GitHub Actions）組み込み（`reuseExistingServer:false` + `playwright install --with-deps` を追加するのみで拡張可能）。
- 全機能網羅テスト（アプローチ機能・証明書 PDF・全フィルタ・ロール別の全 forbidden パターン等）。スモーク安定後に同枠組みで追加。
- Preview 環境での E2E 有効化（要セキュリティレビュー）。

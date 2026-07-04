# Participant E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google OAuthを除く参加者向け機能P-2〜P-14とアカウント削除を、再実行可能なPlaywright E2Eで検証する。

**Architecture:** 既存のローカル専用テスト認証を維持し、診断・ライフサイクル・削除用の参加者ペルソナを追加する。各ペルソナのDB状態を`seed:e2e`で冪等に再構築し、E2Eは機能領域別ファイルへ分割する。

**Tech Stack:** Next.js 16、TypeScript、Supabase Auth、Prisma、Vitest、Playwright

**Status:** 2026-07-01 実装・完了ゲート実行済み

## Global Constraints

- Google OAuthプロバイダーとの通信はE2E対象外とする。
- UIまたはServer Actionの本番振る舞いは、E2Eで不具合が判明しない限り変更しない。
- E2Eの固定時間待機は使用しない。
- locatorはrole、label、heading、表示テキストを優先する。
- 既存の`.agent-shared/mcp/servers.json`変更には触れない。

---

### Task 1: シナリオ別ペルソナと冪等seed

**Files:**
- Modify: `app/src/lib/test-auth/personas.ts`
- Modify: `app/src/lib/test-auth/personas.test.ts`
- Modify: `app/scripts/seed-e2e.test.ts`
- Modify: `app/scripts/seed-e2e.ts`
- Modify: `app/e2e/auth.setup.ts`

**Interfaces:**
- Produces: `participant-diagnosis`、`participant-lifecycle`、`participant-delete`のstorage state
- Produces: lifecycle用の応募・アプローチ・証明書固定データ
- Consumes: 既存`PERSONAS`、`seedE2eUsers()`、Prismaモデル

- [ ] **Step 1: Persona解決の失敗テストを追加する**

`personas.test.ts`で新しい3キーを`resolvePersona()`へ渡し、現状は`null`になることを確認する。

```ts
it.each([
  "participant-diagnosis",
  "participant-lifecycle",
  "participant-delete",
])("%s を解決できる", (key) => {
  expect(resolvePersona(key)?.role).toBe("participant");
});
```

- [ ] **Step 2: Personaテストを実行してREDを確認する**

Run: `cd app && npx vitest run src/lib/test-auth/personas.test.ts`
Expected: 新しいキーが未定義のためFAIL

- [ ] **Step 3: Persona型・定義・auth setupを追加する**

```ts
| "participant-diagnosis"
| "participant-lifecycle"
| "participant-delete"
```

各ペルソナのメールは`e2e-participant-<用途>@example.com`とし、`auth.setup.ts`では同名のJSONへ保存する。

- [ ] **Step 4: Seed UTに必要なPrisma mockと期待値を追加する**

`Approach`、`Certificate`、追加の`MatchingCandidate`をmockし、以下をassertする。

```ts
expect(mocks.participantProfileUpsert).toHaveBeenCalledWith(
  expect.objectContaining({ where: { userId: "participant-delete-id" } })
);
expect(mocks.approachUpsert).toHaveBeenCalledTimes(3);
expect(mocks.certificateUpsert).toHaveBeenCalledTimes(3);
```

- [ ] **Step 5: Seed UTを実行してREDを確認する**

Run: `cd app && npx vitest run scripts/seed-e2e.test.ts`
Expected: 新しいプロフィール・Approach・Certificate作成が呼ばれずFAIL

- [ ] **Step 6: Seedへ最小実装を追加する**

追加データは固定タイトルで検索してupsertし、次の状態を毎回復元する。

```ts
const lifecycleStatuses = ["applied", "accepted", "completed"] as const;
const approachStatuses = ["sent", "sent", "sent"] as const;
const certificateStatuses = ["pending", "issued", "rejected"] as const;
```

アプローチ2件は未来の期限、1件は過去の期限にする。発行済み証明書には固定番号、却下証明書には理由を設定する。削除ペルソナはAuthユーザーが存在しなければ`createUser()`され、参加者プロフィールも再作成する。

- [ ] **Step 7: Persona・Seed UTをGREENにする**

Run: `cd app && npx vitest run src/lib/test-auth/personas.test.ts scripts/seed-e2e.test.ts`
Expected: PASS

---

### Task 2: オンボーディング・簡易/詳細診断・再診断

**Files:**
- Create: `app/e2e/participant-onboarding.spec.ts`
- Create: `app/e2e/participant-diagnosis.spec.ts`
- Modify: `app/e2e/participant.spec.ts`

**Interfaces:**
- Consumes: `participant-fresh.json`、`participant-diagnosis.json`
- Consumes: 診断画面の「1: まったく当てはまらない」〜「5: とても当てはまる」ボタン

- [ ] **Step 1: オンボーディングE2Eを追加する**

```ts
test("P-2: 参加者ロールを選びプロフィールを登録できる", async ({ page }) => {
  await page.goto("/onboarding/role");
  await page.getByRole("button", { name: /ボランティアに参加する/ }).click();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByLabel("表示名").fill("E2E 新規参加者");
  await page.getByLabel("年").selectOption("1998");
  await page.getByLabel("月").selectOption("4");
  await page.getByLabel("日").selectOption("1");
  await page.getByLabel("都道府県").selectOption("東京都");
  await page.getByRole("button", { name: "プロフィールを登録" }).click();
  await expect(page).toHaveURL(/\/diagnosis/);
});
```

- [ ] **Step 2: 診断E2Eを追加する**

回答helperをテストファイル内へ定義する。

```ts
async function answerAll(page: Page, count: number) {
  for (let index = 1; index <= count; index += 1) {
    await expect(page.getByText(`質問 ${index} / ${count}`)).toBeVisible();
    await page.getByRole("button", { name: /3:/ }).click();
  }
}
```

簡易16問、結果表示、結果画面からの再診断、詳細60問をそれぞれ画面操作で確認する。

- [ ] **Step 3: 対象E2Eを実行してREDを確認する**

Run: `cd app && npx playwright test e2e/participant-onboarding.spec.ts e2e/participant-diagnosis.spec.ts --project=chromium`
Expected: seedまたはselectorの不足を示すFAIL

- [ ] **Step 4: selectorを実画面に合わせ、重複する既存P1を整理する**

既存`participant.spec.ts`からオンボーディング誘導ケースを新ファイルへ移し、同じ振る舞いを二重実行しない。

- [ ] **Step 5: 対象E2EをGREENにする**

Run: 同上
Expected: PASS

---

### Task 3: おすすめ・詳細・応募・プロフィール編集

**Files:**
- Create: `app/e2e/participant-discovery.spec.ts`
- Modify: `app/e2e/participant.spec.ts`

**Interfaces:**
- Consumes: `participant-onboarded.json`
- Consumes: `E2E 応募対象案件`とフィルター用固定案件

- [ ] **Step 1: 検索・詳細・応募テストを追加する**

次の独立ケースを作る。

```ts
test("P-5: カテゴリ・地域・参加形態でおすすめを絞り込める", ...);
test("P-6: 案件詳細から団体詳細と公開案件を確認できる", ...);
test("P-7/P-8: メッセージ付き応募を行い応募詳細で確認できる", ...);
test("P-7: 同じ案件へ重複応募できない", ...);
```

- [ ] **Step 2: プロフィール編集テストを追加する**

名前を`E2E 参加者(編集済み)`へ更新し、マイページへ戻った後の表示をassertする。

- [ ] **Step 3: 対象E2EをRED確認後、selectorとseedを最小修正する**

Run: `cd app && npx playwright test e2e/participant-discovery.spec.ts --project=chromium`
Expected RED: 必要なフィルター案件またはlocatorが未整備

- [ ] **Step 4: 既存participant.spec.tsの重複ケースを移動してGREENにする**

Run: 同上
Expected: PASS

---

### Task 4: 応募状態・LINE・アプローチ・証明書

**Files:**
- Create: `app/e2e/participant-lifecycle.spec.ts`

**Interfaces:**
- Consumes: `participant-lifecycle.json`
- Consumes: applied/accepted/completedの応募、回答可能2件＋期限切れ1件のApproach、3状態のCertificate

- [ ] **Step 1: 応募状態とLINE秘匿/開示テストを追加する**

審査中の応募にはLINEがなく、承認済み応募詳細には団体LINE IDまたは友だち追加導線があることを確認する。

- [ ] **Step 2: アプローチテストを追加する**

```ts
test("P-9/P-10: アプローチを受信して承諾できる", ...);
test("P-10: 別のアプローチを辞退できる", ...);
test("P-10: 期限切れアプローチには回答できない", ...);
```

承諾後だけ連絡先カードが表示されることも同一フローでassertする。

- [ ] **Step 3: 証明書テストを追加する**

活動完了済み応募から申請し、一覧で申請中・発行済み・却下を確認する。発行済み詳細からdownloadイベントを待ち、`.pdf`ファイル名と0より大きいサイズを確認する。

- [ ] **Step 4: 対象E2EをRED確認後GREENにする**

Run: `cd app && npx playwright test e2e/participant-lifecycle.spec.ts --project=chromium`
Expected RED: lifecycle seed未整備時は対象カードが見つからない
Expected GREEN after Task 1 seed: PASS

---

### Task 5: 削除専用ペルソナの物理削除

**Files:**
- Create: `app/e2e/participant-account.spec.ts`
- Test: `app/scripts/seed-e2e.test.ts`

**Interfaces:**
- Consumes: `participant-delete.json`
- Produces: 削除完了トーストを表示し、消費済みクエリを除いた`/login`へ遷移する検証

- [ ] **Step 1: アカウント削除E2Eを追加する**

```ts
test("参加者アカウントを物理削除できる", async ({ page }) => {
  await page.goto("/mypage");
  await page.getByLabel(/確認のため/).fill("削除する");
  await page.getByRole("button", { name: "アカウントを削除" }).click();
  await expect(page.getByText("アカウントを削除しました")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 2: E2Eを実行してRED/GREENを確認する**

Run: `cd app && npx playwright test e2e/participant-account.spec.ts --project=chromium`
Expected: Task 1の再作成seed後PASS

- [ ] **Step 3: seedを2回実行して削除後の再作成を確認する**

Run: `cd app && npm run seed:e2e && npm run seed:e2e`
Expected: 2回とも成功し、削除ペルソナが作成または更新される

---

### Task 6: 全体検証と完了ゲート

**Files:**
- Modify if needed: `specs/e2e-playwright-smoke.md`

**Interfaces:**
- Consumes: 全変更
- Produces: Test Completion Gateの結果

- [ ] **Step 1: 重複・固定待機・対象IDを静的確認する**

Run: `rg -n "waitForTimeout|P-[2-9]|P-1[0-4]" app/e2e/participant*.spec.ts`
Expected: `waitForTimeout`なし、P-2〜P-14が各ケースに登場

- [ ] **Step 2: 対象UTと全UTを実行する**

Run: `cd app && npx vitest run scripts/seed-e2e.test.ts src/lib/test-auth/personas.test.ts`
Run: `cd app && npm test`
Expected: PASS

- [ ] **Step 3: lintとbuildを実行する**

Run: `cd app && npm run lint`
Run: `cd app && npm run build`
Expected: PASS

- [ ] **Step 4: 全E2Eを実行する**

Run: `make e2e`
Expected: 全PlaywrightケースPASS

- [ ] **Step 5: 差分とIssue対応を確認する**

Run: `git diff --check && git status --short && git diff --stat`
Expected: `.agent-shared/mcp/servers.json`以外の変更はIssue #163の設計・計画・テスト・seedに限定される

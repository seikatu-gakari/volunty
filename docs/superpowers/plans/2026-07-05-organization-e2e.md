# 団体向けE2Eテスト拡充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存 O1〜O3 を維持し、Issue #167 の団体主要業務 O-E1〜O-E10 を専用ペルソナ・冪等 seed・Playwright E2E で検証できるようにする。

**Architecture:** 団体の読み取り系と変更系をペルソナ・レコード単位で分離し、`seed:e2e` が毎回すべての変更状態を復元する。E2E はオンボーディング系と業務ライフサイクル系に分割し、活動完了履歴だけは既存履歴機能の `completed` 状態漏れを最小修正する。

**Tech Stack:** Next.js 16、React 19、TypeScript 5 strict、Prisma/PostgreSQL、Supabase Auth、Vitest、Playwright

## Global Constraints

- 既存 `app/e2e/organization.spec.ts` の O1〜O3 を削除・重複実装しない。
- UI テキスト、コードコメント、説明、コミットメッセージは日本語にする。
- `any` は使用せず、既存型または `unknown` と型ガードを使う。
- E2E はローカル Supabase と既存テスト認証だけを使用し、本番・Vercel Preview・外部サービスへ接続しない。
- 変更系ケースは `organization-lifecycle` と専用レコードを使う。
- 固定時間待機、CSS クラス依存セレクタ、テスト間の順序依存を使用しない。
- 実装はテストを先に追加し、期待した理由の RED を確認してから最小実装で GREEN にする。
- 完了時に対象 UT、全 UT、lint、型チェック、build、`make e2e` 2回連続を成功させる。
- ユーザー所有の `.codex/config.toml` 変更を編集・stage・commit しない。

---

### Task 1: 団体専用ペルソナと認証 state を追加する

**Files:**
- Modify: `app/src/lib/test-auth/personas.test.ts`
- Modify: `app/src/lib/test-auth/personas.ts`
- Modify: `app/e2e/auth.setup.ts`

**Interfaces:**
- Consumes: 既存 `PersonaKey`、`Persona`、`PERSONAS`、`resolvePersona(key: string): Persona | null`
- Produces: `organization-fresh`、`organization-reapply`、`organization-profile-review`、`organization-lifecycle`、`organization-foreign` と対応する storage state

- [ ] **Step 1: 新しい団体ペルソナの失敗テストを書く**

`personas.test.ts` に次を追加する。

```ts
it.each([
  "organization-fresh",
  "organization-reapply",
  "organization-profile-review",
  "organization-lifecycle",
  "organization-foreign",
])("%s を団体ペルソナとして解決できる", (key) => {
  expect(resolvePersona(key)?.role).toBe("organization");
});
```

- [ ] **Step 2: RED を確認する**

Run: `cd app && npx vitest run src/lib/test-auth/personas.test.ts`

Expected: 新しいキーを `resolvePersona()` が解決できず `undefined` になるため FAIL。

- [ ] **Step 3: ペルソナ定義を最小実装する**

`PersonaKey` と `PERSONAS` に次の値を追加する。

```ts
"organization-fresh": {
  key: "organization-fresh",
  email: "e2e-org-fresh@example.com",
  role: "organization",
  description: "団体オンボーディング専用（seedで未登録へ戻す）",
},
"organization-reapply": {
  key: "organization-reapply",
  email: "e2e-org-reapply@example.com",
  role: "organization",
  description: "否認理由確認と再申請専用（seedでrejectedへ戻す）",
},
"organization-profile-review": {
  key: "organization-profile-review",
  email: "e2e-org-profile-review@example.com",
  role: "organization",
  description: "承認済みプロフィール編集後の再審査専用",
},
"organization-lifecycle": {
  key: "organization-lifecycle",
  email: "e2e-org-lifecycle@example.com",
  role: "organization",
  description: "案件・応募・アプローチ・証明書の変更専用",
},
"organization-foreign": {
  key: "organization-foreign",
  email: "e2e-org-foreign@example.com",
  role: "organization",
  description: "所有権境界用の別団体",
},
```

`auth.setup.ts` の `personas` 配列へ次を追加する。

```ts
{ key: "organization-fresh", file: "organization-fresh" },
{ key: "organization-reapply", file: "organization-reapply" },
{ key: "organization-profile-review", file: "organization-profile-review" },
{ key: "organization-lifecycle", file: "organization-lifecycle" },
{ key: "organization-foreign", file: "organization-foreign" },
```

- [ ] **Step 4: GREEN と型チェックを確認する**

Run: `cd app && npx vitest run src/lib/test-auth/personas.test.ts && npx tsc --noEmit`

Expected: persona テスト成功、TypeScript エラーなし。

- [ ] **Step 5: コミットする**

```bash
git add app/src/lib/test-auth/personas.test.ts app/src/lib/test-auth/personas.ts app/e2e/auth.setup.ts
git commit -m "test: 団体E2Eペルソナを追加"
```

### Task 2: 団体E2Eの専用状態を seed し、毎回巻き戻す

**Files:**
- Modify: `app/scripts/seed-e2e.test.ts`
- Modify: `app/scripts/seed-e2e.ts`

**Interfaces:**
- Consumes: Task 1 の5ペルソナ、既存 `seedE2eUsers(): Promise<void>`
- Produces: O-E1〜O-E10 が参照する固定タイトル・団体プロフィール・案件・応募・アプローチ・証明書の冪等初期状態

- [ ] **Step 1: Prisma mock と seed 巻き戻しの失敗テストを追加する**

`seed-e2e.test.ts` の mock に次を追加する。

```ts
organizationProfileDeleteMany: vi.fn(),
opportunityDeleteMany: vi.fn(),
approachDeleteMany: vi.fn(),
```

Prisma mock は対応する model に `deleteMany` を公開する。`beforeEach` の `mocks.personas` へ Task 1 と同じ5ペルソナを追加し、各 delete mock は `{ count: 0 }` を返す。

既存の状態データテストに次の検証を追加する。

```ts
expect(mocks.updateUserById).toHaveBeenCalledWith(
  "organization-fresh-id",
  expect.objectContaining({
    user_metadata: {
      full_name: "E2E organization-fresh",
      onboarding_completed: false,
      role: null,
    },
  })
);
expect(mocks.organizationProfileDeleteMany).toHaveBeenCalledWith({
  where: { userId: "organization-fresh-id" },
});
expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
  expect.objectContaining({
    where: { userId: "organization-reapply-id" },
    update: expect.objectContaining({
      reviewStatus: "rejected",
      reviewComment: "E2E 再申請前の否認理由",
    }),
  })
);
expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
  expect.objectContaining({
    where: { userId: "organization-profile-review-id" },
    update: expect.objectContaining({ reviewStatus: "approved", verified: true }),
  })
);
expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
  expect.objectContaining({
    where: { userId: "organization-lifecycle-id" },
    update: expect.objectContaining({ reviewStatus: "approved", verified: true }),
  })
);
expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
  expect.objectContaining({
    where: { userId: "organization-foreign-id" },
    update: expect.objectContaining({ reviewStatus: "approved", verified: true }),
  })
);
expect(mocks.opportunityDeleteMany).toHaveBeenCalledWith({
  where: {
    organizationId: "lifecycle-org-id",
    title: { startsWith: "E2E 団体案件管理" },
  },
});
expect(mocks.approachDeleteMany).toHaveBeenCalledWith({
  where: expect.objectContaining({ organizationId: "lifecycle-org-id" }),
});
expect(mocks.approachUpsert).toHaveBeenCalledWith(
  expect.objectContaining({ update: expect.objectContaining({ status: "accepted" }) })
);
expect(mocks.approachUpsert).toHaveBeenCalledWith(
  expect.objectContaining({ update: expect.objectContaining({ status: "declined" }) })
);
expect(mocks.matchingCandidateUpsert).toHaveBeenCalledWith(
  expect.objectContaining({ update: expect.objectContaining({ status: "declined" }) })
);
expect(mocks.certificateUpsert).toHaveBeenCalledWith(
  expect.objectContaining({ update: expect.objectContaining({ status: "pending" }) })
);
```

- [ ] **Step 2: RED を確認する**

Run: `cd app && npx vitest run scripts/seed-e2e.test.ts`

Expected: fresh 団体の metadata・削除、追加団体 upsert、状態別アプローチ・応募・証明書が未実装のため FAIL。

- [ ] **Step 3: fresh metadata と団体プロフィール初期化を実装する**

`buildUserMetadata()` の未登録判定を次に変更する。

```ts
const isFresh =
  persona.key === "participant-fresh" ||
  persona.key === "organization-fresh";

if (isFresh) {
  metadata.role = null;
  metadata.onboarding_completed = false;
} else {
  metadata.role = persona.role;
  metadata.onboarding_completed = true;
}
```

全 persona ID を取得後、fresh 団体プロフィールを削除する。

```ts
const orgFreshId = requirePersonaId(idByEmail, "organization-fresh");
const orgReapplyId = requirePersonaId(idByEmail, "organization-reapply");
const orgProfileReviewId = requirePersonaId(idByEmail, "organization-profile-review");
const orgLifecycleId = requirePersonaId(idByEmail, "organization-lifecycle");
const orgForeignId = requirePersonaId(idByEmail, "organization-foreign");

await prisma.organizationProfile.deleteMany({ where: { userId: orgFreshId } });
```

reapply/profile-review/lifecycle/foreign は次の共通入力値をそれぞれの `organizationProfile.upsert()` の create/update へ明示する。

```ts
{
  representativeName: "E2E 代表者",
  contactEmail: personaEmail,
  activityAreas: ["東京都"],
  description: "団体向けE2Eの固定プロフィールです。",
  activityCategories: ["地域活性化"],
  websiteUrl: "https://example.com/volunty-e2e",
  logoUrl: "https://example.com/volunty-e2e.png",
  contactLineId: "@volunty-e2e",
  contactLineUrl: "https://line.me/R/ti/p/@volunty-e2e",
  profileCompleteness: 100,
}
```

状態は reapply=`rejected/verified=false/reviewComment="E2E 再申請前の否認理由"`、他3件=`approved/verified=true/reviewComment=null` とする。団体名は順に `E2E再申請団体`、`E2Eプロフィール再審査団体`、`E2Eライフサイクル団体`、`E2E別団体` とする。

- [ ] **Step 4: lifecycle 専用レコードを実装する**

`upsertMatchingCandidate()` の status 型を次へ広げる。

```ts
status: "applied" | "accepted" | "declined" | "completed";
```

lifecycle 団体の作成・編集テスト残骸を seed ごとに削除する。

```ts
await prisma.opportunity.deleteMany({
  where: {
    organizationId: lifecycleOrganization.id,
    title: { startsWith: "E2E 団体案件管理" },
  },
});
```

おすすめ順を決定的にするため、既存 `BIG5_SCORES` に加えて次を定義し、`participant-lifecycle` のプロフィール `diagnosisScores` をこの値へ戻す。`participant-onboarded` は既存 `BIG5_SCORES` を維持する。

```ts
const LOW_BIG5_SCORES = {
  extraversion: 20,
  agreeableness: 25,
  conscientiousness: 30,
  neuroticism: 75,
  openness: 25,
};
```

`recommendationHigh` は既存 `BIG5_SCORES` を `requirementTraits` に持つ公開案件とし、高相性の `participant-onboarded` が低相性の `participant-lifecycle` より先に並ぶ状態を作る。

既存 `upsertPublishedOpportunity()` を使い、以下の固定案件を lifecycle 団体所有で作る。

```ts
const lifecycleTitles = {
  recommendationHigh: "E2E 団体おすすめ高相性案件",
  recommendationLow: "E2E 団体おすすめ低相性案件",
  approachSend: "E2E 団体アプローチ送信案件",
  approachSent: "E2E 団体アプローチ未回答案件",
  approachAccepted: "E2E 団体アプローチ承諾済み案件",
  approachDeclined: "E2E 団体アプローチ辞退済み案件",
  approachExpired: "E2E 団体アプローチ期限切れ案件",
  applicantDecline: "E2E 団体応募辞退案件",
  historyAccepted: "E2E 団体履歴承認案件",
  historyDeclined: "E2E 団体履歴辞退案件",
  historyComplete: "E2E 団体活動完了案件",
  certificateApprove: "E2E 団体証明書承認案件",
  certificateReject: "E2E 団体証明書却下案件",
} as const;
```

応募は `applicantDecline=applied`、`historyAccepted=accepted`、`historyDeclined=declined`、`historyComplete=accepted`、証明書2件=`completed` とする。応募メッセージは案件名を含む固定値にする。

アプローチ送信用の組合せは `deleteMany` で消し、履歴用4件を次の状態へ upsert する。

```ts
const approachStates = [
  [lifecycleTitles.approachSent, "sent", future, null],
  [lifecycleTitles.approachAccepted, "accepted", future, now],
  [lifecycleTitles.approachDeclined, "declined", future, now],
  [lifecycleTitles.approachExpired, "sent", past, null],
] as const;
```

証明書承認用・却下用は別 application に `status="pending"`、番号・承認日時・発行日時・却下日時・却下理由をすべて `null` で upsert する。foreign 団体にも公開案件 `E2E 別団体所有案件` を1件作り、lifecycle 団体の所有レコードと混同しない。

- [ ] **Step 5: GREEN と連続 seed の冪等性を確認する**

Run:

```bash
cd app && npx vitest run scripts/seed-e2e.test.ts src/lib/test-auth/personas.test.ts
cd app && npm run seed:e2e
cd app && npm run seed:e2e
```

Expected: UT 成功。seed 2回とも例外なく完了し、unique 制約違反なし。

- [ ] **Step 6: コミットする**

```bash
git add app/scripts/seed-e2e.test.ts app/scripts/seed-e2e.ts
git commit -m "test: 団体E2Eの状態seedを追加"
```

### Task 3: 活動完了をマッチング履歴へ含める

**Files:**
- Modify: `app/src/lib/dashboard/matching-history.test.ts`
- Modify: `app/src/lib/dashboard/types.ts`
- Modify: `app/src/lib/dashboard/actions.ts`
- Modify: `app/src/app/dashboard/history/page.tsx`

**Interfaces:**
- Consumes: `fetchMatchingHistory(): Promise<MatchingHistoryResult>`、DB status `accepted | declined | completed`
- Produces: UI status `approved | rejected | completed` とラベル `承認済み | 辞退済み | 活動完了`

- [ ] **Step 1: completed 履歴の失敗テストを書く**

既存「自団体の承認・辞退済み応募を処理日時順で返す」へ completed レコードを追加し、期待値へ次を追加する。

```ts
{
  id: "application-completed",
  status: "completed",
  appliedAt: new Date("2026-06-01T08:00:00.000Z"),
  statusChangedAt: new Date("2026-06-11T09:00:00.000Z"),
  matchScore: 91,
  participant: {
    name: "完了 参加者",
    participantProfile: { name: "完了 花子" },
  },
  opportunity: { id: "opportunity-3", title: "活動完了案件" },
}
```

```ts
{
  id: "application-completed",
  status: "completed",
  participant_name: "完了 花子",
  opportunity_id: "opportunity-3",
  opportunity_title: "活動完了案件",
  applied_at: "2026-06-01T08:00:00.000Z",
  status_changed_at: "2026-06-11T09:00:00.000Z",
  match_score: 91,
}
```

Prisma 条件の期待値は `status: { in: ["accepted", "declined", "completed"] }` とする。

- [ ] **Step 2: RED を確認する**

Run: `cd app && npx vitest run src/lib/dashboard/matching-history.test.ts`

Expected: completed が query 条件と変換結果に含まれないため FAIL。

- [ ] **Step 3: 型・変換・表示を最小修正する**

```ts
export type MatchingHistoryStatus = Extract<
  ApplicationStatus,
  "approved" | "rejected" | "completed"
>;
```

`mapMatchingHistoryStatus()` に `if (dbStatus === "completed") return "completed";` を追加し、Prisma 条件を `in: ["accepted", "declined", "completed"]` にする。型コメント・戻り値コメント・関数説明は「承認・辞退・活動完了」に更新する。

履歴ページの `statusDisplay()` に次を追加する。

```tsx
case "completed":
  return {
    label: "活動完了",
    icon: <CheckCircle2 className="size-4" />,
    color: "text-primary bg-primary/10 border-primary/20",
  };
```

ページ説明と空表示を「承認・辞退・活動完了」に更新する。

- [ ] **Step 4: GREEN と関連回帰を確認する**

Run: `cd app && npx vitest run src/lib/dashboard/matching-history.test.ts src/lib/dashboard/applicants.test.ts`

Expected: 両テスト成功。

- [ ] **Step 5: コミットする**

```bash
git add app/src/lib/dashboard/matching-history.test.ts app/src/lib/dashboard/types.ts app/src/lib/dashboard/actions.ts app/src/app/dashboard/history/page.tsx
git commit -m "fix: 活動完了をマッチング履歴へ表示"
```

### Task 4: 団体オンボーディングと再審査 E2E を追加する

**Files:**
- Create: `app/e2e/organization-onboarding.spec.ts`

**Interfaces:**
- Consumes: `organization-fresh.json`、`organization-reapply.json`、`organization-profile-review.json`
- Produces: Playwright テスト名 `O-E1`、`O-E2`、`O-E3`

- [ ] **Step 1: O-E1〜O-E3 を実装する**

ファイルは3つの describe を持ち、それぞれ `test.use({ storageState })` を指定する。

O-E1 は `/onboarding/role` で `ボランティアを募集する` と `次へ` を押し、次を入力する。

```ts
await page.getByLabel("団体名").fill("E2E新規団体");
await page.getByLabel("代表者名").fill("E2E 新規代表者");
await page.getByLabel("連絡先メールアドレス").fill("e2e-org-fresh@example.com");
await page.getByText("東京都", { exact: true }).click();
await page.getByLabel("LINE公式アカウントID").fill("@e2e-fresh");
await page.getByRole("button", { name: "登録して審査を申請する" }).click();
await expect(page).toHaveURL(/\/onboarding\/pending$/);
await expect(page.getByRole("heading", { name: "審査中です" })).toBeVisible();
```

O-E2 は `/onboarding/pending` で `申請は否認されました`、`否認理由`、`E2E 再申請前の否認理由` を確認する。`申請内容を修正する` からフォームへ進み、団体名を `E2E再申請団体 更新済み` に変更して `内容を更新して再申請する` を押す。pending URL、`審査中です`、更新後団体名を確認する。

O-E3 は `/dashboard/profile/edit` で団体名を `E2Eプロフィール再審査団体 更新済み` に変更して再申請する。`審査中です` を確認後 `/dashboard` へ直接遷移し、`/onboarding/pending` へ制限されることを確認する。

- [ ] **Step 2: 対象 E2E を実行する**

Run: `cd app && npx playwright test e2e/organization-onboarding.spec.ts --project=chromium`

Expected: O-E1〜O-E3 が成功。

- [ ] **Step 3: セレクタと独立性を確認する**

Run: `rg -n "waitForTimeout|locator\(.*\\.|nth\(" app/e2e/organization-onboarding.spec.ts`

Expected: 出力なし。各テストは別 storage state と専用レコードを使う。

- [ ] **Step 4: コミットする**

```bash
git add app/e2e/organization-onboarding.spec.ts
git commit -m "test: 団体オンボーディングE2Eを追加"
```

### Task 5: 団体業務ライフサイクル E2E と対応表を追加する

**Files:**
- Create: `app/e2e/organization-lifecycle.spec.ts`
- Modify: `specs/e2e-playwright-smoke.md`

**Interfaces:**
- Consumes: `organization-lifecycle.json`、Task 2 の固定タイトル、Task 3 の活動完了履歴
- Produces: Playwright テスト名 `O-E4`〜`O-E10` と O-E1〜O-E10 対応表

- [ ] **Step 1: 固定タイトルと共通認証を定義する**

```ts
import { expect, test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/organization-lifecycle.json" });

const TITLES = {
  approachSend: "E2E 団体アプローチ送信案件",
  applicantDecline: "E2E 団体応募辞退案件",
  historyAccepted: "E2E 団体履歴承認案件",
  historyDeclined: "E2E 団体履歴辞退案件",
  historyComplete: "E2E 団体活動完了案件",
  certificateApprove: "E2E 団体証明書承認案件",
  certificateReject: "E2E 団体証明書却下案件",
} as const;
```

- [ ] **Step 2: O-E4〜O-E7 を実装する**

O-E4 はタイトル `E2E 団体案件管理 ${Date.now()}` で案件を作る。説明、場所 `渋谷区`、開始日 `2026-08-01`、終了日 `2026-08-31`、定員 `12`、カテゴリ `環境保全`、参加形態 `ハイブリッド`、外向性 checkbox とスコア `80` を入力する。作成後のダッシュボードで作成タイトルのリンクを押して案件詳細へ進み、編集リンクを開く。説明を `編集後の案件説明です。` に変更、`募集終了` を選択して保存し、詳細画面に編集文と `募集終了` が表示されることを確認する。

O-E5 は `/dashboard/participants` で `おすすめ参加者` と2名以上を確認し、相性スコア要素の先頭値が2件目以上であることを数値化して確認する。先頭参加者のリンクから詳細へ進み、`相性概要`、`プロフィール`、`BIG5 特性`、対象案件名を確認する。

O-E6 はおすすめ参加者詳細から `アプローチする` を押し、`関連する募集案件` で `TITLES.approachSend` を選び、`アプローチ文` に `E2E 団体からのアプローチメッセージ` を入力して送信する。成功文と履歴への参加者名・案件名を確認し、同じ作成画面へ戻って同案件 option が `（送信済み）` かつ disabled であることを確認する。

O-E7 は `/dashboard/approaches` で見出しと `未回答`、`承諾済み`、`辞退済み`、`期限切れ` をそれぞれ確認する。

- [ ] **Step 3: O-E8〜O-E10 を実装する**

O-E8 は `/dashboard` から `TITLES.applicantDecline` の案件へ進み、応募者詳細で応募メッセージ、診断タイプ、`BIG5 スコア詳細` を確認する。`辞退する` を押し、`辞退済み` を確認する。

O-E9 は `TITLES.historyComplete` の案件で承認済み応募の `活動完了にする` を押し、`活動完了` を確認する。`/dashboard/history` へ移動し、`TITLES.historyAccepted` と `承認済み`、`TITLES.historyDeclined` と `辞退済み`、`TITLES.historyComplete` と `活動完了` を、それぞれ案件名を含むカード範囲で確認する。

O-E10 は `/dashboard/certificates` から `TITLES.certificateApprove` の申請詳細へ進み `承認して発行する` を押す。成功文後に reload し、`発行済み` と `証明書番号` を確認する。次に `TITLES.certificateReject` を開き、`却下理由` に `E2E 証明書却下理由` を入力して `却下する` を押す。成功文後に reload し、`却下` と理由を確認する。

- [ ] **Step 4: E2E 仕様へ対応表を追加する**

`specs/e2e-playwright-smoke.md` 冒頭の更新履歴へ、次の対応を追加する。

```md
> **2026-07-05 団体E2E拡張**: 団体シナリオ O-E1〜O-E10 は
> [`docs/superpowers/specs/2026-07-05-organization-e2e-design.md`](../docs/superpowers/specs/2026-07-05-organization-e2e-design.md)
> を最新仕様とする。既存 O1〜O3 を維持し、オンボーディング系と業務ライフサイクル系へ拡張した。

| ID | Playwright spec |
| --- | --- |
| O-E1〜O-E3 | `app/e2e/organization-onboarding.spec.ts` |
| O-E4〜O-E10 | `app/e2e/organization-lifecycle.spec.ts` |
```

- [ ] **Step 5: 対象 E2E と静的チェックを実行する**

Run:

```bash
cd app && npx playwright test e2e/organization.spec.ts e2e/organization-onboarding.spec.ts e2e/organization-lifecycle.spec.ts --project=chromium
rg -n "waitForTimeout|locator\(.*\\.|nth\(" app/e2e/organization*.spec.ts
```

Expected: O1〜O3、O-E1〜O-E10 が成功。`rg` は出力なし。

- [ ] **Step 6: コミットする**

```bash
git add app/e2e/organization-lifecycle.spec.ts specs/e2e-playwright-smoke.md
git commit -m "test: 団体業務フローE2Eを追加"
```

## Final Verification

全タスクのレビュー通過後、親エージェントが次を順に実行する。

```bash
cd app && npx vitest run scripts/seed-e2e.test.ts src/lib/test-auth/personas.test.ts src/lib/dashboard/matching-history.test.ts
cd app && npm test
cd app && npm run lint
cd app && npx tsc --noEmit
cd app && npm run build
make e2e
make e2e
```

完了報告には `volunty-test-completion-gate` の表を記載し、UT・E2E とも「必須」、追加パス、RED/GREEN、最終コマンド結果を明記する。

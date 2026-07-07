# Common Foundation E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue #166 の C-E1〜C-E7 を追加し、認証・認可・所有権・セッション・モバイル導線を Playwright とユニットテストで継続検証できるようにする。

**Architecture:** 既存のテスト認証 API と `storageState` を維持し、追加ペルソナと冪等 seed で境界条件を作る。ロール単位のルート認可は `proxy.ts` に集約し、所有権は既存ドメイン処理の絞り込みを E2E の URL 直アクセスで検証する。Google OAuth プロバイダーとの実通信は行わない。

**Tech Stack:** Next.js App Router、TypeScript、Supabase Auth、Prisma、Vitest、Testing Library、Playwright

## Global Constraints

- UI テキスト、コードコメント、説明は日本語にする。
- TypeScript で `any` を使用しない。
- import は `@/` エイリアスを優先する。
- 固定時間待機と CSS クラス依存の Playwright セレクタを使用しない。
- Google OAuth プロバイダーとの実通信を行わず、`/api/test-auth/login` を使用する。
- 本番・Vercel Preview に対する破壊的テストを行わない。
- ユーザー既存変更 `.codex/config.toml` を編集・stage・commit しない。

---

## File Map

- Modify: `app/src/lib/test-auth/personas.ts` — 境界テスト用ペルソナ定義
- Modify: `app/src/lib/test-auth/personas.test.ts` — ペルソナ解決の UT
- Modify: `app/e2e/auth.setup.ts` — 審査状態・別所有者の storage state 作成
- Modify: `app/scripts/seed-e2e.ts` — 審査状態・所有者・凍結状態の冪等 seed
- Modify: `app/scripts/seed-e2e.test.ts` — seed と巻き戻しの UT
- Modify: `app/src/proxy.ts` — ロール別ルート認可
- Modify: `app/src/proxy.test.ts` — 認可マトリクス UT
- Modify: `app/src/app/(auth)/login/page.tsx` — 凍結理由の表示
- Modify: `app/src/app/(auth)/login/page.test.tsx` — 凍結表示 UT
- Create: `app/e2e/common-boundaries.spec.ts` — C-E1〜C-E7

---

### Task 1: 境界テスト用ペルソナを定義する

**Files:**
- Modify: `app/src/lib/test-auth/personas.test.ts`
- Modify: `app/src/lib/test-auth/personas.ts`
- Modify: `app/e2e/auth.setup.ts`

**Interfaces:**
- Produces: `PersonaKey` に `participant-suspended`、`organization-rejected`、`organization-secondary` を追加する。
- Produces: `playwright/.auth/organization-rejected.json` と `playwright/.auth/organization-secondary.json` を生成する。
- Constraint: `participant-suspended` はログイン直後に強制退出されるため storage state を生成しない。

- [ ] **Step 1: 追加ペルソナの失敗テストを書く**

`app/src/lib/test-auth/personas.test.ts` の参加者ペルソナ表へ `participant-suspended` を追加し、次のテストを追加する。

```typescript
it.each([
  ["organization-rejected", "organization"],
  ["organization-secondary", "organization"],
] as const)("%s を %s ペルソナとして解決できる", (key, role) => {
  expect(resolvePersona(key)?.role).toBe(role);
});
```

- [ ] **Step 2: テストが期待どおり失敗することを確認する**

Run: `cd app && npx vitest run src/lib/test-auth/personas.test.ts`

Expected: `participant-suspended`、`organization-rejected`、`organization-secondary` が未定義のため FAIL。

- [ ] **Step 3: ペルソナ定義を追加する**

`app/src/lib/test-auth/personas.ts` の `PersonaKey` と `PERSONAS` に次を追加する。

```typescript
| "participant-suspended"
| "organization-rejected"
| "organization-secondary"
```

```typescript
"participant-suspended": {
  key: "participant-suspended",
  email: "e2e-participant-suspended@example.com",
  role: "participant",
  description: "凍結済みユーザーの強制退出確認専用",
},
"organization-rejected": {
  key: "organization-rejected",
  email: "e2e-org-rejected@example.com",
  role: "organization",
  description: "否認済み団体",
},
"organization-secondary": {
  key: "organization-secondary",
  email: "e2e-org-secondary@example.com",
  role: "organization",
  description: "他団体所有データへのアクセス境界確認専用",
},
```

`app/e2e/auth.setup.ts` の `personas` に次を追加する。

```typescript
{ key: "organization-rejected", file: "organization-rejected" },
{ key: "organization-secondary", file: "organization-secondary" },
```

- [ ] **Step 4: ペルソナ UT を通す**

Run: `cd app && npx vitest run src/lib/test-auth/personas.test.ts`

Expected: PASS。

- [ ] **Step 5: ペルソナ変更をコミットする**

```bash
git add app/src/lib/test-auth/personas.ts app/src/lib/test-auth/personas.test.ts app/e2e/auth.setup.ts
git commit -m "test: 認可境界用E2Eペルソナを追加"
```

---

### Task 2: 審査状態・別所有者・凍結状態を seed する

**Files:**
- Modify: `app/scripts/seed-e2e.test.ts`
- Modify: `app/scripts/seed-e2e.ts`

**Interfaces:**
- Consumes: Task 1 の `PERSONAS`。
- Produces: `organization-rejected` は `reviewStatus="rejected"`、`organization-secondary` は `reviewStatus="approved"`、`participant-suspended` は `isActive=false`。
- Preserves: `participant-suspendable` は管理者 E2E 用に毎回 `isActive=true` へ戻す。

- [ ] **Step 1: seed の失敗テストを拡張する**

`app/scripts/seed-e2e.test.ts` の `mocks.personas` に Task 1 の3ペルソナを追加する。状態データのテストでは organization upsert を4回返すようにする。

```typescript
mocks.organizationProfileUpsert
  .mockReset()
  .mockResolvedValueOnce({ id: "approved-org-id" })
  .mockResolvedValueOnce({ id: "pending-org-id" })
  .mockResolvedValueOnce({ id: "rejected-org-id" })
  .mockResolvedValueOnce({ id: "secondary-org-id" });
```

同じテストへ次の期待値を追加する。

```typescript
expect(mocks.organizationProfileUpsert).toHaveBeenCalledTimes(4);
expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
  expect.objectContaining({
    where: { userId: "organization-rejected-id" },
    update: expect.objectContaining({
      reviewStatus: "rejected",
      verified: false,
    }),
  })
);
expect(mocks.organizationProfileUpsert).toHaveBeenCalledWith(
  expect.objectContaining({
    where: { userId: "organization-secondary-id" },
    update: expect.objectContaining({
      reviewStatus: "approved",
      verified: true,
    }),
  })
);
expect(mocks.userUpdate).toHaveBeenCalledWith({
  where: { id: "participant-suspended-id" },
  data: expect.objectContaining({
    isActive: false,
    suspendReason: "E2E凍結ユーザー",
  }),
});
```

- [ ] **Step 2: seed UT が期待どおり失敗することを確認する**

Run: `cd app && npx vitest run scripts/seed-e2e.test.ts`

Expected: organization upsert が2回のまま、凍結済み update が無いため FAIL。

- [ ] **Step 3: seed 対象 ID と団体状態を追加する**

`app/scripts/seed-e2e.ts` で ID を取得する。

```typescript
const suspendedId = requirePersonaId(idByEmail, "participant-suspended");
const orgRejectedId = requirePersonaId(idByEmail, "organization-rejected");
const orgSecondaryId = requirePersonaId(idByEmail, "organization-secondary");
```

既存 pending 団体 upsert の後へ次を追加する。

```typescript
await prisma.organizationProfile.upsert({
  where: { userId: orgRejectedId },
  update: {
    organizationName: "E2E否認済み団体",
    reviewStatus: "rejected",
    verified: false,
    reviewComment: "E2E否認理由",
    profileCompleteness: 80,
    activityAreas: ["埼玉県"],
    activityCategories: ["福祉"],
  },
  create: {
    userId: orgRejectedId,
    organizationName: "E2E否認済み団体",
    reviewStatus: "rejected",
    verified: false,
    reviewComment: "E2E否認理由",
    profileCompleteness: 80,
    activityAreas: ["埼玉県"],
    activityCategories: ["福祉"],
  },
});

await prisma.organizationProfile.upsert({
  where: { userId: orgSecondaryId },
  update: {
    organizationName: "E2E別所有者団体",
    reviewStatus: "approved",
    verified: true,
    profileCompleteness: 100,
    activityAreas: ["千葉県"],
    activityCategories: ["教育"],
  },
  create: {
    userId: orgSecondaryId,
    organizationName: "E2E別所有者団体",
    reviewStatus: "approved",
    verified: true,
    profileCompleteness: 100,
    activityAreas: ["千葉県"],
    activityCategories: ["教育"],
  },
});
```

- [ ] **Step 4: 凍結状態と既存巻き戻しを共存させる**

既存 `participant-suspendable` の active リセットを残し、その後へ追加する。

```typescript
await prisma.user.update({
  where: { id: suspendedId },
  data: {
    isActive: false,
    suspendedAt: new Date(),
    suspendReason: "E2E凍結ユーザー",
    suspendedBy: null,
  },
});
```

- [ ] **Step 5: seed UT を通す**

Run: `cd app && npx vitest run scripts/seed-e2e.test.ts src/lib/test-auth/personas.test.ts`

Expected: PASS。

- [ ] **Step 6: seed 変更をコミットする**

```bash
git add app/scripts/seed-e2e.ts app/scripts/seed-e2e.test.ts
git commit -m "test: E2E認可境界のseed状態を追加"
```

---

### Task 3: proxy にロール別ルート境界を追加する

**Files:**
- Modify: `app/src/proxy.test.ts`
- Modify: `app/src/proxy.ts`

**Interfaces:**
- Produces: `isRoleAllowed(pathname: string, role: AppRole): boolean`。
- Behavior: 他ロール専用 prefix は `/forbidden`、同ロールまたは共通ルートは通過する。
- Ordering: 凍結、オンボーディング、ロール未選択、オンボーディング未完了の既存判定を先に行う。

- [ ] **Step 1: 認可マトリクスの失敗テストを書く**

`app/src/proxy.test.ts` の認証済み helper をロール指定可能にする。

```typescript
function mockAuthenticatedSession(
  request: NextRequest,
  userId: string,
  role: "participant" | "organization" | "admin" = "participant"
) {
  mocks.updateSession.mockResolvedValue({
    response: NextResponse.next({ request }),
    user: {
      id: userId,
      user_metadata: { role, onboarding_completed: true },
    },
  });
}
```

次のテストを追加する。

```typescript
it.each([
  ["participant", "/dashboard"],
  ["participant", "/admin"],
  ["organization", "/mypage"],
  ["organization", "/admin"],
  ["admin", "/mypage"],
  ["admin", "/dashboard"],
] as const)("%s は %s へ越境できない", async (role, pathname) => {
  const request = createRequest(pathname);
  mockAuthenticatedSession(request, `${role}-1`, role);
  mocks.maybeSingle.mockResolvedValueOnce({ data: { is_active: true } });

  const response = await proxy(request);
  const location = new URL(response.headers.get("location") ?? "", request.url);

  expect(location.pathname).toBe("/forbidden");
});
```

- [ ] **Step 2: proxy UT が期待どおり失敗することを確認する**

Run: `cd app && npx vitest run src/proxy.test.ts`

Expected: 現状は他ロールのルートを通すため FAIL。

- [ ] **Step 3: ロール境界 helper を実装する**

`app/src/proxy.ts` のルート分類へ追加する。

```typescript
type AppRole = "participant" | "organization" | "admin";

const ROLE_PATH_PREFIXES: Record<AppRole, readonly string[]> = {
  participant: [
    "/diagnosis",
    "/mypage",
    "/opportunities",
    "/organizations",
    "/recommendations",
  ],
  organization: ["/dashboard"],
  admin: ["/admin"],
};

function isAppRole(value: unknown): value is AppRole {
  return value === "participant" || value === "organization" || value === "admin";
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isRoleAllowed(pathname: string, role: AppRole): boolean {
  const owner = (Object.entries(ROLE_PATH_PREFIXES) as [AppRole, readonly string[]][])
    .find(([, prefixes]) => prefixes.some((prefix) => matchesPrefix(pathname, prefix)))
    ?.[0];
  return owner === undefined || owner === role;
}
```

- [ ] **Step 4: 既存フローへ認可判定を挿入する**

metadata 取得後、ロール未選択・オンボーディング未完了を処理してから次を実行する。管理者の `/` リダイレクトは維持し、管理者を無条件 return しない。

```typescript
const rawRole = metadata.role;
if (!isAppRole(rawRole)) {
  const url = request.nextUrl.clone();
  url.pathname = "/onboarding/role";
  return redirectWithCookies(url, response);
}
const role = rawRole;

if (role === "admin" && pathname === "/") {
  const url = request.nextUrl.clone();
  url.pathname = "/admin/organizations";
  return redirectWithCookies(url, response);
}

if (role !== "admin" && !metadata.onboarding_completed) {
  const url = request.nextUrl.clone();
  url.pathname = role === "organization"
    ? "/onboarding/organization"
    : "/onboarding/participant";
  return redirectWithCookies(url, response);
}

if (!isRoleAllowed(pathname, role)) {
  const url = request.nextUrl.clone();
  url.pathname = "/forbidden";
  return redirectWithCookies(url, response);
}
```

- [ ] **Step 5: proxy UT を通す**

Run: `cd app && npx vitest run src/proxy.test.ts`

Expected: 既存4件と認可マトリクス6件が PASS。

- [ ] **Step 6: proxy 変更をコミットする**

```bash
git add app/src/proxy.ts app/src/proxy.test.ts
git commit -m "fix: ロール別の保護ルート境界を追加"
```

---

### Task 4: ログイン画面へ凍結理由を表示する

**Files:**
- Modify: `app/src/app/(auth)/login/page.test.tsx`
- Modify: `app/src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `/auth/signout` が生成する `/login?error=suspended`。
- Produces: `role="alert"` の日本語メッセージ「このアカウントは凍結されています。」。

- [ ] **Step 1: 凍結表示の失敗テストを書く**

`app/src/app/(auth)/login/page.test.tsx` に追加する。

```typescript
it("凍結理由付きの場合はエラーメッセージを表示する", async () => {
  window.history.replaceState(
    null,
    "",
    "http://localhost:3000/login?error=suspended"
  );

  render(<LoginPage />);

  expect(
    await screen.findByRole("alert", {
      name: "このアカウントは凍結されています。",
    })
  ).toBeDefined();
});

it("通常のログインでは凍結エラーを表示しない", () => {
  render(<LoginPage />);
  expect(screen.queryByRole("alert")).toBeNull();
});
```

- [ ] **Step 2: ログイン画面 UT が期待どおり失敗することを確認する**

Run: `cd app && npx vitest run 'src/app/(auth)/login/page.test.tsx'`

Expected: alert が存在しないため FAIL。

- [ ] **Step 3: hydration 安全な凍結表示を実装する**

`app/src/app/(auth)/login/page.tsx` へ `useEffect` と `useState` を追加し、component 内で query を読む。

```typescript
const [isSuspended, setIsSuspended] = useState(false);

useEffect(() => {
  const error = new URLSearchParams(window.location.search).get("error");
  setIsSuspended(error === "suspended");
}, []);
```

`GoogleAuthButton` の直前へ追加する。

```tsx
{isSuspended && (
  <p
    role="alert"
    aria-label="このアカウントは凍結されています。"
    className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
  >
    このアカウントは凍結されています。
  </p>
)}
```

- [ ] **Step 4: ログイン画面 UT を通す**

Run: `cd app && npx vitest run 'src/app/(auth)/login/page.test.tsx'`

Expected: PASS。

- [ ] **Step 5: 凍結表示をコミットする**

```bash
git add 'app/src/app/(auth)/login/page.tsx' 'app/src/app/(auth)/login/page.test.tsx'
git commit -m "fix: 凍結ユーザーのログインエラーを表示"
```

---

### Task 5: C-E1〜C-E5 の E2E を追加する

**Files:**
- Create: `app/e2e/common-boundaries.spec.ts`

**Interfaces:**
- Consumes: Task 1 の storage state、Task 2 の seed、Task 3 の proxy、Task 4 の alert。
- Produces: C-E1〜C-E5 の Playwright テスト。

- [ ] **Step 1: spec の認証 state と context helper を定義する**

新規ファイルの先頭へ記述する。

```typescript
import { expect, test, type Browser, type Page } from "@playwright/test";

const AUTH_STATE = {
  participant: "playwright/.auth/participant.json",
  organization: "playwright/.auth/organization.json",
  organizationPending: "playwright/.auth/organization-pending.json",
  organizationRejected: "playwright/.auth/organization-rejected.json",
  admin: "playwright/.auth/admin.json",
} as const;

async function openAuthenticatedPage(browser: Browser, storageState: string) {
  const context = await browser.newContext({ storageState });
  return { context, page: await context.newPage() };
}

async function expectForbidden(page: Page, hiddenText: string) {
  await expect(page).toHaveURL(/\/forbidden$/);
  await expect(
    page.getByRole("heading", { name: "このページにはアクセスできません" })
  ).toBeVisible();
  await expect(page.getByText(hiddenText, { exact: true })).toHaveCount(0);
}
```

- [ ] **Step 2: C-E1 と C-E2 を記述する**

```typescript
test("C-E1: 保護ルートは未認証ユーザーを復帰先付きログインへ戻す", async ({ page }) => {
  for (const path of ["/mypage", "/dashboard", "/admin"] as const) {
    await page.goto(path);
    await expect(page).toHaveURL((url) =>
      url.pathname === "/login" && url.searchParams.get("next") === path
    );
  }
});

test("C-E2: ロール越境を認可マトリクスで拒否する", async ({ browser }) => {
  const cases = [
    [AUTH_STATE.participant, "/dashboard", "募集案件一覧"],
    [AUTH_STATE.participant, "/admin", "管理ダッシュボード"],
    [AUTH_STATE.organization, "/mypage", "マイページ"],
    [AUTH_STATE.organization, "/admin", "管理ダッシュボード"],
    [AUTH_STATE.admin, "/mypage", "マイページ"],
    [AUTH_STATE.admin, "/dashboard", "募集案件一覧"],
  ] as const;

  for (const [storageState, path, hiddenText] of cases) {
    const { context, page } = await openAuthenticatedPage(browser, storageState);
    await page.goto(path);
    await expectForbidden(page, hiddenText);
    await context.close();
  }
});
```

- [ ] **Step 3: C-E3〜C-E5 を記述する**

```typescript
test("C-E3: 団体審査状態に応じてダッシュボード利用可否を分ける", async ({ browser }) => {
  for (const storageState of [
    AUTH_STATE.organizationPending,
    AUTH_STATE.organizationRejected,
  ]) {
    const { context, page } = await openAuthenticatedPage(browser, storageState);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding\/pending$/);
    await expect(page.getByText("E2E承認済み団体")).toHaveCount(0);
    await context.close();
  }

  const approved = await openAuthenticatedPage(browser, AUTH_STATE.organization);
  await approved.page.goto("/dashboard");
  await expect(
    approved.page.getByRole("heading", { name: "ダッシュボード" })
  ).toBeVisible();
  await approved.context.close();
});

test("C-E4: ログアウト後は保護ルートへ戻れない", async ({ browser }) => {
  const { context, page } = await openAuthenticatedPage(browser, AUTH_STATE.participant);
  await page.goto("/mypage");
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.goto("/mypage");
  await expect(page).toHaveURL((url) =>
    url.pathname === "/login" && url.searchParams.get("next") === "/mypage"
  );
  await context.close();
});

test("C-E5: 凍結済みユーザーを強制退出して理由を表示する", async ({ page }) => {
  await page.goto(
    "/api/test-auth/login?persona=participant-suspended&next=/mypage"
  );
  await expect(page).toHaveURL((url) =>
    url.pathname === "/login" && url.searchParams.get("error") === "suspended"
  );
  await expect(
    page.getByRole("alert", { name: "このアカウントは凍結されています。" })
  ).toBeVisible();
  await page.goto("/mypage");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});
```

- [ ] **Step 4: 新規 E2E の初回実行結果を確認する**

Run: `cd app && npx playwright test e2e/common-boundaries.spec.ts --project=chromium`

Expected: setup と C-E1〜C-E5 が PASS。失敗時は Playwright trace と実際の URL・role 名を確認し、固定待機を追加せず実装またはセレクタを修正する。

- [ ] **Step 5: C-E1〜C-E5 をコミットする**

```bash
git add app/e2e/common-boundaries.spec.ts
git commit -m "test: 認証認可境界のE2Eを追加"
```

---

### Task 6: C-E6 の所有権境界 E2E を追加する

**Files:**
- Modify: `app/e2e/common-boundaries.spec.ts`

**Interfaces:**
- Consumes: 主所有者 `organization.json` と別所有者 `organization-secondary.json`。
- Behavior: 主所有者の実リンクから URL を取得し、別所有者が直アクセスしても情報・更新 UI を得られない。

- [ ] **Step 1: 主所有者から3種類の URL を取得する E2E を追加する**

```typescript
test("C-E6: 他団体の案件・応募者・証明書を閲覧更新できない", async ({ browser }) => {
  const owner = await openAuthenticatedPage(browser, AUTH_STATE.organization);
  await owner.page.goto("/dashboard");
  const opportunityHref = await owner.page
    .getByRole("link", { name: /E2E 団体フロー案件/ })
    .getAttribute("href");
  expect(opportunityHref).not.toBeNull();

  await owner.page.goto(opportunityHref!);
  const editHref = await owner.page
    .getByRole("link", { name: "編集" })
    .getAttribute("href");
  const applicantHref = await owner.page
    .getByRole("link", { name: "詳細を見る" })
    .first()
    .getAttribute("href");

  await owner.page.goto("/dashboard/certificates");
  const certificateHref = await owner.page
    .getByRole("link", { name: /E2E 申請中証明書案件/ })
    .getAttribute("href");
  expect(editHref).not.toBeNull();
  expect(applicantHref).not.toBeNull();
  expect(certificateHref).not.toBeNull();
  await owner.context.close();

  const other = await openAuthenticatedPage(
    browser,
    "playwright/.auth/organization-secondary.json"
  );
```

- [ ] **Step 2: 別所有者の直アクセス結果を検証する**

同じテストを次で完結させる。

```typescript
  const editResponse = await other.page.goto(editHref!);
  expect(editResponse?.status()).toBe(404);
  await expect(other.page.getByLabel("案件タイトル")).toHaveCount(0);

  const applicantResponse = await other.page.goto(applicantHref!);
  expect(applicantResponse?.status()).toBe(404);
  await expect(other.page.getByText("E2E 参加者(診断済)")).toHaveCount(0);
  await expect(other.page.getByRole("button", { name: "承認する" })).toHaveCount(0);

  await other.page.goto(certificateHref!);
  await expect(other.page.getByText("証明書申請が見つかりません")).toBeVisible();
  await expect(other.page.getByRole("button", { name: "発行する" })).toHaveCount(0);
  await expect(other.page.getByRole("button", { name: "却下する" })).toHaveCount(0);
  await other.context.close();
});
```

- [ ] **Step 3: C-E6 を実行する**

Run: `cd app && npx playwright test e2e/common-boundaries.spec.ts --project=chromium --grep 'C-E6'`

Expected: PASS。既存所有権ガードに欠陥があれば、該当 action の `organizationId` 条件と UT を同じ TDD サイクルで修正してから再実行する。

- [ ] **Step 4: C-E6 をコミットする**

```bash
git add app/e2e/common-boundaries.spec.ts
git commit -m "test: 団体所有権境界のE2Eを追加"
```

---

### Task 7: C-E7 のモバイル主要導線 E2E を追加する

**Files:**
- Modify: `app/e2e/common-boundaries.spec.ts`

**Interfaces:**
- Consumes: 参加者・承認済み団体・管理者の storage state。
- Produces: 390x844 viewport で3ロールの代表ナビゲーションを検証する。

- [ ] **Step 1: モバイル導線テストを追加する**

```typescript
test("C-E7: モバイル表示で各ロールの主要導線を操作できる", async ({ browser }) => {
  const viewport = { width: 390, height: 844 };

  const participantContext = await browser.newContext({
    storageState: AUTH_STATE.participant,
    viewport,
  });
  const participantPage = await participantContext.newPage();
  await participantPage.goto("/");
  await participantPage.getByRole("button", { name: "メニューを開く" }).click();
  await participantPage.getByRole("link", { name: "マイページ" }).click();
  await expect(participantPage).toHaveURL(/\/mypage$/);
  await participantContext.close();

  const organizationContext = await browser.newContext({
    storageState: AUTH_STATE.organization,
    viewport,
  });
  const organizationPage = await organizationContext.newPage();
  await organizationPage.goto("/");
  await organizationPage.getByRole("button", { name: "メニューを開く" }).click();
  await organizationPage.getByRole("link", { name: "ダッシュボード" }).click();
  await expect(organizationPage).toHaveURL(/\/dashboard$/);
  await organizationContext.close();

  const adminContext = await browser.newContext({
    storageState: AUTH_STATE.admin,
    viewport,
  });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin");
  await adminPage.getByRole("link", { name: "団体審査一覧" }).click();
  await expect(adminPage).toHaveURL(/\/admin\/organizations$/);
  await adminContext.close();
});
```

- [ ] **Step 2: C-E7 を実行する**

Run: `cd app && npx playwright test e2e/common-boundaries.spec.ts --project=chromium --grep 'C-E7'`

Expected: PASS。

- [ ] **Step 3: C-E7 をコミットする**

```bash
git add app/e2e/common-boundaries.spec.ts
git commit -m "test: モバイル主要導線のE2Eを追加"
```

---

### Task 8: 完了ゲートと全検証を実行する

**Files:**
- Modify only if verification finds an Issue #166 regression: files directly responsible for that regression and their colocated tests

**Interfaces:**
- Consumes: Task 1〜7 の全変更。
- Produces: Issue #166 の受け入れ条件を満たす検証記録。

- [ ] **Step 1: 対象ユニットテストを実行する**

Run:

```bash
cd app && npx vitest run scripts/seed-e2e.test.ts src/lib/test-auth/personas.test.ts src/proxy.test.ts 'src/app/(auth)/login/page.test.tsx'
```

Expected: 全テスト PASS。

- [ ] **Step 2: 全ユニットテストを実行する**

Run: `cd app && npm test`

Expected: 全テスト PASS。

- [ ] **Step 3: lint・型チェック・build を実行する**

Run:

```bash
cd app && npm run lint
cd app && npx tsc --noEmit
cd app && npm run build
```

Expected: 3コマンドとも終了コード0。

- [ ] **Step 4: E2E を2回連続実行する**

Run:

```bash
make e2e
make e2e
```

Expected: 既存 G1〜G3、既存参加者・団体・管理者テスト、C-E1〜C-E7 が2回とも PASS。

- [ ] **Step 5: diff と受け入れ条件を確認する**

Run:

```bash
git diff --check HEAD^..HEAD
git status --short
rg -n "C-E[1-7]:|G[1-3]:" app/e2e
```

Expected: whitespace error なし、`.codex/config.toml` 以外に意図しない変更なし、C-E1〜C-E7 と G1〜G3 が全て追跡可能。

---

## Completion Checklist

- C-E1〜C-E7 がテスト名から追跡できる。
- 既存 G1〜G3 を変更せず成功させる。
- 変更系テストは専用ペルソナまたはテストごとの独立 context を使う。
- seed の追加状態と巻き戻しを UT で検証する。
- 固定時間待機と CSS クラス依存セレクタを追加しない。
- Google OAuth 実通信を行わない。
- `make e2e` が2回連続で成功する。

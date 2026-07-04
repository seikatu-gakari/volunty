import { expect, test, type Browser, type Page } from "@playwright/test";

const AUTH_STATE = {
  participant: "playwright/.auth/participant.json",
  participantLogout: "playwright/.auth/participant-logout.json",
  organization: "playwright/.auth/organization.json",
  organizationPendingReadonly:
    "playwright/.auth/organization-pending-readonly.json",
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

test("C-E3: 団体審査状態に応じてダッシュボード利用可否を分ける", async ({ browser }) => {
  for (const storageState of [
    AUTH_STATE.organizationPendingReadonly,
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
  const { context, page } = await openAuthenticatedPage(
    browser,
    AUTH_STATE.participantLogout
  );
  await page.goto("/diagnosis");
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();
  await page.goto("/diagnosis");
  await expect(page).toHaveURL((url) =>
    url.pathname === "/login" && url.searchParams.get("next") === "/diagnosis"
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

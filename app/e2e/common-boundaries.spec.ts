import { expect, test, type Browser, type Page } from "@playwright/test";

const AUTH_STATE = {
  participant: "playwright/.auth/participant.json",
  participantDiagnosis: "playwright/.auth/participant-diagnosis.json",
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
    await page.getByRole("link", { name: "トップへ戻る" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: "このページにはアクセスできません" })
    ).toHaveCount(0);
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
  await other.page.goto(editHref!);
  await expect(
    other.page.getByRole("heading", { name: "ページが見つかりません" })
  ).toBeVisible();
  await expect(other.page.getByLabel("案件タイトル")).toHaveCount(0);

  await other.page.goto(applicantHref!);
  await expect(
    other.page.getByRole("heading", { name: "ページが見つかりません" })
  ).toBeVisible();
  await expect(other.page.getByText("E2E 参加者(診断済)")).toHaveCount(0);
  await expect(
    other.page.getByRole("button", { name: "承認する" })
  ).toHaveCount(0);

  await other.page.goto(certificateHref!);
  await expect(
    other.page.getByText("証明書申請が見つかりません")
  ).toBeVisible();
  await expect(
    other.page.getByRole("button", { name: "発行する" })
  ).toHaveCount(0);
  await expect(
    other.page.getByRole("button", { name: "却下する" })
  ).toHaveCount(0);
  await other.context.close();
});

test("C-E7: モバイル表示で各ロールの主要導線を操作できる", async ({ browser }) => {
  const viewport = { width: 390, height: 844 };

  const participantContext = await browser.newContext({
    storageState: AUTH_STATE.participant,
    viewport,
  });
  const participantPage = await participantContext.newPage();
  await participantPage.goto("/");
  await expect(
    participantPage.getByRole("heading", { name: "性格傾向チェックを始める" })
  ).toHaveCount(0);
  await participantPage.getByRole("button", { name: "メニューを開く" }).click();
  await participantPage.getByRole("link", { name: "マイページ" }).click();
  await expect(participantPage).toHaveURL(/\/mypage$/);
  await participantContext.close();

  const participantDiagnosisContext = await browser.newContext({
    storageState: AUTH_STATE.participantDiagnosis,
    viewport,
  });
  const participantDiagnosisPage = await participantDiagnosisContext.newPage();
  await participantDiagnosisPage.goto("/");
  await expect(
    participantDiagnosisPage.getByRole("heading", {
      name: "性格傾向チェックを始める",
    })
  ).toHaveCount(0);
  await participantDiagnosisPage
    .getByRole("button", { name: "メニューを開く" })
    .click();
  await participantDiagnosisPage.getByRole("link", { name: "マイページ" }).click();
  await expect(participantDiagnosisPage).toHaveURL(/\/mypage$/);
  await expect(
    participantDiagnosisPage.getByRole("heading", {
      name: "性格傾向チェックを始める",
    })
  ).toBeVisible();
  await participantDiagnosisContext.close();

  const organizationContext = await browser.newContext({
    storageState: AUTH_STATE.organization,
    viewport,
  });
  const organizationPage = await organizationContext.newPage();
  await organizationPage.goto("/");
  await expect(
    organizationPage.getByRole("heading", { name: "性格傾向チェックを始める" })
  ).toHaveCount(0);
  await organizationPage.getByRole("button", { name: "メニューを開く" }).click();
  await organizationPage.getByRole("link", { name: "ダッシュボード" }).click();
  await expect(organizationPage).toHaveURL(/\/dashboard$/);
  await organizationContext.close();

  const adminContext = await browser.newContext({
    storageState: AUTH_STATE.admin,
    viewport,
  });
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/");
  await expect(
    adminPage.getByRole("heading", { name: "性格傾向チェックを始める" })
  ).toHaveCount(0);
  await adminPage.goto("/admin");
  await adminPage.getByRole("link", { name: "団体審査一覧" }).click();
  await expect(adminPage).toHaveURL(/\/admin\/organizations$/);
  await adminContext.close();
});

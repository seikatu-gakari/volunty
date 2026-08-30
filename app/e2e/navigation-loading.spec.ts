import { expect, test } from "@playwright/test";

const AUTH_STATE = {
  participant: "playwright/.auth/participant.json",
  organization: "playwright/.auth/organization.json",
  admin: "playwright/.auth/admin.json",
} as const;

const SEEDED_OPPORTUNITY_TITLE = "E2E 応募対象案件";

test.describe("主要画面の読み取り遷移", () => {
  test("participant: トップからマイページ・おすすめ・案件詳細へ遷移できる", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE.participant,
    });
    const page = await context.newPage();

    try {
      await page.goto("/");
      await page.getByRole("link", { name: "マイページ", exact: true }).first().click();
      await expect(page.getByRole("heading", { name: "マイページ" })).toBeVisible();

      await page.locator("header").getByRole("link", { name: /ボランティ/ }).click();
      await expect(page).toHaveURL(/\/$/);

      await page
        .getByRole("link", { name: "おすすめ案件", exact: true })
        .first()
        .click();
      await expect(page.getByRole("heading", { name: "おすすめ案件" })).toBeVisible();
      await page
        .getByRole("link", { name: new RegExp(SEEDED_OPPORTUNITY_TITLE) })
        .click();
      await expect(
        page.getByRole("heading", { name: SEEDED_OPPORTUNITY_TITLE }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("organization: トップからダッシュボードへ遷移できる", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE.organization,
    });
    const page = await context.newPage();

    try {
      await page.goto("/");
      await page.getByRole("link", { name: "ダッシュボード", exact: true }).first().click();
      await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("admin: トップから管理画面へ遷移できる", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE.admin });
    const page = await context.newPage();

    try {
      await page.goto("/");
      await page.getByRole("link", { name: /管理ダッシュボード/ }).first().click();
      await expect(page.getByRole("heading", { name: "管理ダッシュボード" })).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test("participant: 遅延した診断画面の描画中にsegment Loading UIを表示する", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: AUTH_STATE.participant,
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await page.route("**/diagnosis*", async (route) => {
      if (!route.request().headers().rsc) {
        await route.continue();
        return;
      }

      await route.continue({
        headers: {
          ...route.request().headers(),
          "x-e2e-delay-diagnosis": "true",
        },
      });
    });
    await page
      .getByRole("link", { name: "診断", exact: true })
      .first()
      .click({ noWaitAfter: true });
    await expect(
      page.getByRole("status", { name: "性格傾向チェックを読み込み中" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "性格傾向チェック" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

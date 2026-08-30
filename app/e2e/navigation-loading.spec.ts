import { expect, test, type Route } from "@playwright/test";

const AUTH_STATE = {
  participant: "playwright/.auth/participant.json",
  organization: "playwright/.auth/organization.json",
  admin: "playwright/.auth/admin.json",
} as const;

const SEEDED_OPPORTUNITY_TITLE = "E2E 応募対象案件";

function createDeferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

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

test("participant: 遅延したRSC遷移中にクリックした診断LinkのLoading UIを表示する", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: AUTH_STATE.participant,
  });
  const page = await context.newPage();
  const requestHeld = createDeferred();
  const releaseRequest = createDeferred();
  let holdingRoute: Route | null = null;

  try {
    await page.goto("/");
    await page.route("**/diagnosis*", async (route) => {
      if (!route.request().headers().rsc || holdingRoute) {
        await route.continue();
        return;
      }

      holdingRoute = route;
      requestHeld.resolve();
      await releaseRequest.promise;
      await route.continue();
    });
    await page
      .getByRole("link", { name: "診断", exact: true })
      .first()
      .click({ noWaitAfter: true });
    await requestHeld.promise;
    await expect(
      page
        .getByRole("link", { name: "診断 ページを読み込み中" })
        .getByRole("status", { name: "ページを読み込み中" }),
    ).toBeVisible();
  } finally {
    releaseRequest.resolve();
    if (holdingRoute) {
      await expect(
        page.getByRole("heading", { name: "性格傾向チェック" }),
      ).toBeVisible();
    }
    await context.close();
  }
});

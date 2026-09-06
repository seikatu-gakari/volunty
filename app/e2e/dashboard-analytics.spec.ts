import { expect, test } from "@playwright/test";

const ANALYTICS_FAILURE_HEADER = "x-e2e-dashboard-analytics-failure";

test.describe("団体ダッシュボード分析の取得失敗", () => {
  test.use({ storageState: "playwright/.auth/organization.json" });

  test("初回失敗から再試行して実集計へ復旧できる", async ({ page }) => {
    await page.context().setExtraHTTPHeaders({
      [ANALYTICS_FAILURE_HEADER]: "true",
    });
    await page.goto("/dashboard");

    const analyticsError = page.getByRole("alert").filter({
      hasText: "分析データを取得できませんでした。時間をおいて再試行してください。",
    });
    await expect(analyticsError).toBeVisible();
    await expect(analyticsError).toContainText(
      "分析データを取得できませんでした。時間をおいて再試行してください。",
    );
    await expect(page.getByRole("heading", { name: "募集案件一覧" })).toBeVisible();
    await expect(page.getByText("閲覧数", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);

    await page.context().setExtraHTTPHeaders({});
    await page.getByRole("button", { name: "分析を再試行" }).click();

    await expect(page.getByText("閲覧数", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("再試行も失敗した場合は数値と表を表示しない", async ({ page }) => {
    await page.context().setExtraHTTPHeaders({
      [ANALYTICS_FAILURE_HEADER]: "true",
    });
    await page.goto("/dashboard");

    await page.getByRole("button", { name: "分析を再試行" }).click();

    await expect(
      page.getByRole("alert").filter({
        hasText: "分析データを取得できませんでした",
      }),
    ).toBeVisible();
    await expect(page.getByText("閲覧数", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
  });
});

test.describe("案件0件の正常な分析結果", () => {
  test.use({ storageState: "playwright/.auth/organization-secondary.json" });

  test("0指標と空状態を表示する", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("閲覧数", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("集計対象の募集案件はありません")).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });
});

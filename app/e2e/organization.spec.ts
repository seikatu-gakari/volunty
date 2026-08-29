import { expect, test } from "@playwright/test";

import { authStatePath } from "../test-support/playwright-auth-state";

const ORGANIZATION_FLOW_OPPORTUNITY_TITLE = "E2E 団体フロー案件";

test.describe("承認済み団体", () => {
  test.use({ storageState: authStatePath("organization.json") });

  test("O1: ダッシュボードに自団体の募集案件を表示する", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "ダッシュボード" })
    ).toBeVisible();
    await expect(page.getByText(ORGANIZATION_FLOW_OPPORTUNITY_TITLE)).toBeVisible();
  });

  test("O2: 新しい募集案件を作成して一覧へ反映する", async ({ page }) => {
    const title = `E2E-${Date.now()}`;

    await page.goto("/dashboard/opportunities/new");
    await page.getByLabel("案件タイトル").fill(title);
    await page
      .getByLabel("案件説明")
      .fill("Playwright E2Eで作成した募集案件です。");
    await page.getByRole("button", { name: "作成する" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(title)).toBeVisible();
  });

  test("O3: 応募者を承認してステータスを更新する", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("link", { name: new RegExp(ORGANIZATION_FLOW_OPPORTUNITY_TITLE) })
      .click();

    await expect(
      page.getByRole("heading", { name: "応募者一覧" })
    ).toBeVisible();
    await expect(page.getByText(/1件の応募/)).toBeVisible();
    await page.getByRole("button", { name: "承認する" }).click();
    await expect(page.getByText("承認済み", { exact: true })).toBeVisible();
  });
});

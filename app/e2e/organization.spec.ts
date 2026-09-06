import { expect, test } from "@playwright/test";

const ORGANIZATION_FLOW_OPPORTUNITY_TITLE = "E2E 団体フロー案件";

test.describe("承認済み団体", () => {
  test.use({ storageState: "playwright/.auth/organization.json" });

  test("O3: 自団体の案件から応募者を承認してステータスを更新する", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "ダッシュボード" })
    ).toBeVisible();
    await expect(page.getByText(ORGANIZATION_FLOW_OPPORTUNITY_TITLE)).toBeVisible();
    await page
      .getByRole("link", { name: new RegExp(ORGANIZATION_FLOW_OPPORTUNITY_TITLE) })
      .click();

    await expect(
      page.getByRole("heading", { name: "応募者一覧" })
    ).toBeVisible();
    await expect(page.getByText(/1件の応募/)).toBeVisible();
    await page.getByRole("link", { name: "詳細を見る" }).click();
    await expect(page.getByText("e2e-participant-line", { exact: true })).toHaveCount(0);
    await page.goto("/dashboard");
    await page
      .getByRole("link", { name: new RegExp(ORGANIZATION_FLOW_OPPORTUNITY_TITLE) })
      .click();
    await page.getByRole("button", { name: "承認する" }).click();
    await expect(page.getByText("承認済み", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("link", { name: "詳細を見る" }).click();
    await expect(
      page.getByRole("heading", { name: "参加者連絡先（LINE ID）" })
    ).toBeVisible();
    await expect(page.getByText("e2e-participant-line", { exact: true })).toBeVisible();
  });
});

import { expect, type Page, test } from "@playwright/test";

function organizationCard(page: Page, name: string) {
  return page.getByRole("article", { name: new RegExp(name) });
}

function historyCard(page: Page, name: string) {
  return page.getByRole("article", { name: new RegExp(name) });
}

test.use({ storageState: "playwright/.auth/admin-review.json" });

test("A-E2/A-E5: 審査詳細で団体情報を確認して承認し履歴に反映する", async ({
  page,
}) => {
  await page.goto("/admin/reviews");

  const card = organizationCard(page, "E2E詳細承認団体");
  await expect(card).toHaveCount(1);
  await card.getByRole("link", { name: "詳細画面を開く" }).click();

  await expect(
    page.getByRole("heading", { name: "団体審査詳細" })
  ).toBeVisible();
  await expect(page.getByText("E2E承認代表")).toBeVisible();
  await expect(
    page.getByText("e2e-review-approve-contact@example.com")
  ).toBeVisible();
  await expect(page.getByText("東京都")).toBeVisible();
  await expect(page.getByText("環境保全")).toBeVisible();
  await expect(
    page.getByText("E2E詳細承認団体の活動内容です。")
  ).toBeVisible();
  await expect(
    page.getByText("https://example.com/e2e-review-approve")
  ).toBeVisible();

  await page.getByRole("button", { name: "承認する" }).click();
  await expect(page).toHaveURL(/\/admin\/reviews$/);

  await page.goto("/admin/reviews/history");
  const approvedHistory = historyCard(page, "E2E詳細承認団体");
  await expect(approvedHistory).toContainText("E2E詳細承認団体");
  await expect(approvedHistory).toContainText("承認済み");
  await expect(approvedHistory).toContainText("E2E admin-review");
  await expect(approvedHistory).toContainText("理由なし");
});

test("A-E3/A-E5: 空理由を検証してから審査詳細で否認し履歴に理由を反映する", async ({
  page,
}) => {
  await page.goto("/admin/reviews");

  const card = organizationCard(page, "E2E詳細否認団体");
  await expect(card).toHaveCount(1);
  await card.getByRole("link", { name: "詳細画面を開く" }).click();

  await expect(page.getByRole("button", { name: "否認する" })).toBeDisabled();
  await page.getByLabel("却下理由").fill("A-E3 否認理由");
  await page.getByRole("button", { name: "否認する" }).click();
  await expect(page).toHaveURL(/\/admin\/reviews$/);

  await page.getByRole("button", { name: /否認済み/ }).click();
  const rejectedCard = organizationCard(page, "E2E詳細否認団体");
  await expect(rejectedCard).toHaveCount(1);
  await rejectedCard.getByRole("button", { name: "詳細を表示" }).click();
  await expect(rejectedCard).toContainText("A-E3 否認理由");

  await page.goto("/admin/reviews/history");
  const rejectedHistory = historyCard(page, "E2E詳細否認団体");
  await expect(rejectedHistory).toContainText("E2E詳細否認団体");
  await expect(rejectedHistory).toContainText("否認済み");
  await expect(rejectedHistory).toContainText("E2E admin-review");
  await expect(rejectedHistory).toContainText("A-E3 否認理由");
});

test("A-E4: 審査一覧の状態フィルターで審査待ち/承認済み/否認済みを切り替える", async ({
  page,
}) => {
  await page.goto("/admin/reviews");

  await page.getByRole("button", { name: /審査待ち/ }).click();
  await expect(page.getByText("E2Eフィルター審査待ち団体")).toBeVisible();
  await expect(page.getByText("E2Eフィルター承認済み団体")).toHaveCount(0);
  await expect(page.getByText("E2Eフィルター否認済み団体")).toHaveCount(0);

  await page.getByRole("button", { name: /承認済み/ }).click();
  await expect(page.getByText("E2Eフィルター承認済み団体")).toBeVisible();
  await expect(page.getByText("E2Eフィルター審査待ち団体")).toHaveCount(0);
  await expect(page.getByText("E2Eフィルター否認済み団体")).toHaveCount(0);

  await page.getByRole("button", { name: /否認済み/ }).click();
  await expect(page.getByText("E2Eフィルター否認済み団体")).toBeVisible();
  await expect(page.getByText("E2Eフィルター審査待ち団体")).toHaveCount(0);
  await expect(page.getByText("E2Eフィルター承認済み団体")).toHaveCount(0);
});

import { expect, test } from "@playwright/test";

const PENDING_ORGANIZATION_NAME = "E2E審査待ち団体";
const SUSPENDABLE_EMAIL = "e2e-user-suspendable@example.com";

test.describe("管理者", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("A1: 管理ダッシュボードに統計を表示する", async ({ page }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "管理ダッシュボード" })
    ).toBeVisible();
    await expect(page.getByText("ユーザー数")).toBeVisible();
    await expect(page.getByText("マッチング数")).toBeVisible();
    await expect(page.getByText("審査待ち件数")).toBeVisible();
  });
});

test.describe("管理者操作", () => {
  test.use({ storageState: "playwright/.auth/admin-review.json" });

  test("A2: 審査待ち団体を承認して承認済み一覧へ反映する", async ({ page }) => {
    await page.goto("/admin/reviews");

    const pendingCard = page.getByRole("article", {
      name: new RegExp(PENDING_ORGANIZATION_NAME),
    });
    await expect(pendingCard).toHaveCount(1);
    await pendingCard.getByRole("button", { name: "承認する" }).click();

    await page.getByRole("button", { name: /承認済み/ }).click();
    await expect(page.getByText(PENDING_ORGANIZATION_NAME)).toBeVisible();
  });

  test("A3: 対象参加者を凍結してから解除する", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByLabel("検索").fill(SUSPENDABLE_EMAIL);

    const userCard = page.getByRole("article", {
      name: new RegExp(SUSPENDABLE_EMAIL),
    });
    await expect(userCard).toHaveCount(1);
    await userCard.getByRole("button", { name: "凍結する" }).click();
    await userCard
      .getByPlaceholder("凍結理由を入力してください")
      .fill("E2E凍結テスト");
    await userCard.getByRole("button", { name: "凍結を確定" }).click();

    await expect(userCard.getByText("停止中")).toBeVisible();
    await userCard.getByRole("button", { name: "凍結を解除" }).click();
    await expect(userCard.getByText("停止中")).toHaveCount(0);
  });
});

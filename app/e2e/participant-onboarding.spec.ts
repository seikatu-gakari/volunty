import { expect, test } from "@playwright/test";

test.describe("参加者オンボーディング", () => {
  test.use({ storageState: "playwright/.auth/participant-fresh.json" });

  test("P-2: 参加者ロールを選びプロフィールを登録できる", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding\/role$/);
    await expect(
      page.getByRole("heading", { name: "利用方法を選択" })
    ).toBeVisible();

    await page
      .getByRole("button", { name: /ボランティアに参加する/ })
      .click();
    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page).toHaveURL(/\/onboarding\/participant$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding\/role$/);

    await page
      .getByRole("button", { name: /ボランティアに参加する/ })
      .click();
    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page).toHaveURL(/\/onboarding\/participant$/);

    await page.getByLabel("表示名").fill("E2E 新規参加者");
    await page.getByLabel("年").selectOption("1998");
    await page.getByLabel("月").selectOption("4");
    await page.getByLabel("日").selectOption("1");
    await page.getByLabel("都道府県").selectOption("東京都");
    await page.getByRole("button", { name: "登録して診断へ進む" }).click();

    await expect(page).toHaveURL(/\/diagnosis$/);
    await expect(
      page.getByRole("heading", { name: "性格傾向チェック" })
    ).toBeVisible();
  });
});

import { expect, test } from "@playwright/test";

test.describe("参加者のアカウント削除", () => {
  test.use({ storageState: "playwright/.auth/participant-delete.json" });

  test("P-15: 確認文字を入力してアカウントを削除できる", async ({ page }) => {
    await page.goto("/mypage");
    await page.getByLabel(/確認のため/).fill("削除する");
    await page.getByRole("button", { name: "アカウントを削除" }).click();

    await expect(page.getByText("アカウントを削除しました")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

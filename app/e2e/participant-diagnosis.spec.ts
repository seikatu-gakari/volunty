import { expect, type Page, test } from "@playwright/test";

async function answerAllQuestions(page: Page, questionCount: number) {
  for (let question = 1; question <= questionCount; question += 1) {
    await expect(page.getByText(`質問 ${question} / ${questionCount}`)).toBeVisible();
    await page.getByRole("button", { name: "どちらともいえない" }).click();
  }
}

test.describe("参加者性格診断", () => {
  test.use({ storageState: "playwright/.auth/participant-diagnosis.json" });

  test("P-3/P-4/P-14: 簡易診断の結果を確認し、詳細診断で再診断できる", async ({
    page,
  }) => {
    await page.goto("/diagnosis?mode=brief");
    await page.getByRole("button", { name: "簡易診断を開始する" }).click();
    await answerAllQuestions(page, 16);

    await expect(page).toHaveURL(/\/diagnosis\/result$/);
    await expect(page.getByRole("heading", { name: "診断結果" })).toBeVisible();
    await expect(page.getByText("簡易診断", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "BIG5 スコア" })).toBeVisible();

    await page.getByRole("link", { name: "再診断する" }).click();
    await page.getByRole("button", { name: /詳細診断/ }).first().click();
    await page.getByRole("button", { name: "詳細診断を開始する" }).click();
    await answerAllQuestions(page, 60);

    await expect(page).toHaveURL(/\/diagnosis\/result$/);
    await expect(page.getByText("詳細診断", { exact: true })).toBeVisible();
  });
});

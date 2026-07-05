import { expect, type Page, test } from "@playwright/test";

const TOTAL_QUESTIONS = 50;
const BRIEF_TOTAL_QUESTIONS = 15;

async function answerQuestions(
  page: Page,
  options: { from: number; to: number; label?: string; totalQuestions?: number }
) {
  const label = options.label ?? "どちらともいえない";
  const totalQuestions = options.totalQuestions ?? TOTAL_QUESTIONS;
  for (let question = options.from; question <= options.to; question += 1) {
    await expect(
      page.getByText(`質問 ${question} / ${totalQuestions}`)
    ).toBeVisible();
    await page.getByRole("button", { name: label }).click();
  }
}

test.describe("参加者性格診断", () => {
  test.use({ storageState: "playwright/.auth/participant-diagnosis.json" });

  test("P-3/P-4: 全50問を回答して結果を確認し、再診断できる", async ({
    page,
  }) => {
    await page.goto("/diagnosis");

    // 開始画面: 非臨床の説明が表示される
    await expect(
      page.getByRole("heading", { name: "性格傾向チェック" })
    ).toBeVisible();
    await expect(
      page.getByText(/医療・心理臨床の診断ではありません/)
    ).toBeVisible();

    await page
      .getByRole("button", { name: "全50問で診断を始める" })
      .click();
    await answerQuestions(page, { from: 1, to: TOTAL_QUESTIONS });

    // 結果画面: 連続スコアが主結果。参考タイプ・尺度情報・スコアの意味を表示
    await expect(page).toHaveURL(/\/diagnosis\/result$/);
    await expect(
      page.getByRole("heading", { name: "診断結果" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "5つの性格特性スコア" })
    ).toBeVisible();
    await expect(
      page.getByText("あなたに近い活動スタイル（参考）")
    ).toBeVisible();
    await expect(
      page.getByText(/性格傾向チェック（全50問）による診断/)
    ).toBeVisible();
    // 全問同一選択肢のため回答品質の注記が表示される（性格の評価ではない旨も明示）
    await expect(page.getByText("回答について")).toBeVisible();
    await expect(
      page.getByText(/あなたの性格の評価ではありません/)
    ).toBeVisible();

    // 再診断導線
    await page.getByRole("link", { name: "再診断する" }).click();
    await expect(
      page.getByRole("heading", { name: "性格傾向チェック" })
    ).toBeVisible();
  });

  test("P-14: 診断を中断しても続きから再開できる", async ({ page }) => {
    await page.goto("/diagnosis");
    await page
      .getByRole("button", { name: /全50問で診断を始める|最初からやり直す/ })
      .click();
    await answerQuestions(page, { from: 1, to: 5, label: "やや当てはまる" });

    // 中断（リロード）して再開
    await page.reload();
    await page.getByRole("button", { name: "続きから再開する" }).click();
    await expect(
      page.getByText(`質問 6 / ${TOTAL_QUESTIONS}`)
    ).toBeVisible();

    // 残りを回答して保存まで到達できる
    await answerQuestions(page, {
      from: 6,
      to: TOTAL_QUESTIONS,
      label: "やや当てはまる",
    });
    await expect(page).toHaveURL(/\/diagnosis\/result$/);
  });

  test("簡易診断（15問）を回答すると結果画面に全50問への案内が表示される", async ({
    page,
  }) => {
    await page.goto("/diagnosis");

    await page
      .getByRole("button", { name: /簡易診断を始める（15問）|最初からやり直す/ })
      .click();
    await answerQuestions(page, {
      from: 1,
      to: BRIEF_TOTAL_QUESTIONS,
      totalQuestions: BRIEF_TOTAL_QUESTIONS,
    });

    await expect(page).toHaveURL(/\/diagnosis\/result$/);
    await expect(
      page.getByText(/性格傾向チェック（簡易15問）による診断/)
    ).toBeVisible();
    await expect(page.getByText("簡易診断について")).toBeVisible();
  });
});

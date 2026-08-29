import { expect, test } from "@playwright/test";

const APPLICATION_OPPORTUNITY_TITLE = "E2E 応募対象案件";
const FILTER_OPPORTUNITY_TITLE = "E2E オンライン環境保全案件";

test.describe.serial("参加者の案件探索と応募", () => {
  test.use({ storageState: "playwright/.auth/participant.json" });

  test("P-5: カテゴリ・地域・参加形態でおすすめ案件を絞り込める", async ({
    page,
  }) => {
    await page.goto("/recommendations");
    await page.getByLabel("カテゴリ").selectOption("環境保全");
    await page.getByLabel("地域").selectOption("新宿区");
    await page.getByLabel("参加形態").selectOption("online");
    await page.getByRole("button", { name: "絞り込む" }).click();

    await expect(page).toHaveURL(/category=.*region=.*participationMode=online/);
    await expect(page.getByText(FILTER_OPPORTUNITY_TITLE)).toBeVisible();
    await expect(page.getByText(APPLICATION_OPPORTUNITY_TITLE)).toHaveCount(0);
  });

  test("P-6: 推薦理由が表示され、案件詳細から団体詳細と公開案件を確認できる", async ({ page }) => {
    await page.goto("/recommendations");

    const applicationCard = page.getByRole("link", {
      name: new RegExp(APPLICATION_OPPORTUNITY_TITLE),
    });

    await expect(
      applicationCard.getByText("活動地域があなたの地域（東京都）に対応しています")
    ).toBeVisible();
    await expect(
      applicationCard.getByText(
        "相手に寄り添う場面が多い活動で、あなたの協調的な傾向が活きやすい内容です"
      )
    ).toBeVisible();

    await applicationCard.click();

    await expect(
      page.getByRole("heading", { name: APPLICATION_OPPORTUNITY_TITLE })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "募集情報" })).toBeVisible();
    await page.getByRole("link", { name: "E2E承認済み団体" }).click();
    await expect(
      page.getByRole("heading", { name: "E2E承認済み団体" })
    ).toBeVisible();
    await expect(page.getByText(APPLICATION_OPPORTUNITY_TITLE)).toBeVisible();
  });

  test("P-7/P-8: メッセージ付きで応募し、応募詳細で内容を確認できる", async ({
    page,
  }) => {
    await page.goto("/recommendations");
    await page
      .getByRole("link", { name: new RegExp(APPLICATION_OPPORTUNITY_TITLE) })
      .click();
    await page
      .getByLabel("応募メッセージ")
      .fill("Playwright E2Eからの参加希望メッセージです");
    await page.getByRole("button", { name: "応募する" }).click();
    await expect(page.getByText("応募が完了しました")).toBeVisible();

    await page.goto("/mypage");
    await page
      .getByRole("heading", { name: APPLICATION_OPPORTUNITY_TITLE })
      .locator("xpath=../../..")
      .getByRole("link", { name: "詳細を見る" })
      .click();
    await expect(
      page.getByRole("heading", { name: APPLICATION_OPPORTUNITY_TITLE })
    ).toBeVisible();
    await expect(
      page.getByText("Playwright E2Eからの参加希望メッセージです")
    ).toBeVisible();
  });

  test("P-7: 応募済み案件には重複応募できない", async ({ page }) => {
    await page.goto("/recommendations");
    await page
      .getByRole("link", { name: new RegExp(APPLICATION_OPPORTUNITY_TITLE) })
      .click();

    await expect(page.getByText("審査中", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "応募する" })).toHaveCount(0);
  });

  test("登録済みプロフィールを編集できる", async ({ page }) => {
    await page.goto("/mypage/profile/edit");
    await page.getByLabel("表示名").fill("E2E 参加者(編集済み)");
    await page.getByRole("button", { name: "更新する" }).click();

    await expect(page).toHaveURL(/\/mypage$/);
    await expect(page.getByText("E2E 参加者(編集済み)")).toBeVisible();
  });

  test("案件を後で見るへ追加し、一覧と詳細から解除できる", async ({ page }) => {
    await page.goto("/opportunities");
    const card = page
      .locator("main > div.grid > div")
      .filter({ hasText: FILTER_OPPORTUNITY_TITLE });
    await card.getByRole("button", { name: "後で見る" }).click();
    await expect(
      card.getByRole("button", { name: "後で見るから解除" })
    ).toBeVisible();

    await page.goto("/mypage/bookmarks");
    await expect(page.getByText(FILTER_OPPORTUNITY_TITLE)).toBeVisible();
    await page.getByRole("button", { name: "後で見るから解除" }).click();
    await expect(page.getByText(FILTER_OPPORTUNITY_TITLE)).toHaveCount(0);

    await page.goto("/opportunities");
    await card.getByRole("button", { name: "後で見る" }).click();
    await page.getByRole("link", { name: FILTER_OPPORTUNITY_TITLE }).click();
    await page.getByRole("button", { name: "後で見るから解除" }).click();
    await expect(page.getByRole("button", { name: "後で見る" })).toBeVisible();
  });
});

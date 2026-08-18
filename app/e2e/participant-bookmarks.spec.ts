import { expect, test } from "@playwright/test";

const BOOKMARK_OPPORTUNITY_TITLE = "E2E オンライン環境保全案件";

test.describe("参加者の後で見る", () => {
  test.use({ storageState: "playwright/.auth/participant.json" });

  test("案件を後で見るに追加し、一覧から解除できる", async ({ page }) => {
    await page.goto("/opportunities");
    const card = page
      .locator("div.rounded-lg.border")
      .filter({
        has: page.getByRole("link", { name: BOOKMARK_OPPORTUNITY_TITLE }),
      });

    await card.getByRole("button", { name: "後で見る" }).click();
    await expect(card.getByText("お気に入りに追加しました")).toBeVisible();

    await page.goto("/mypage/bookmarks");
    await expect(
      page.getByRole("heading", { name: BOOKMARK_OPPORTUNITY_TITLE })
    ).toBeVisible();

    await page.getByRole("button", { name: "リストから外す" }).click();
    await expect(page.getByText("後で見る案件はまだありません。")).toBeVisible();
  });
});

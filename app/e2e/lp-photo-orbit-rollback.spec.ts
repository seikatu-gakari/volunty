import { expect, test } from "@playwright/test";

test.describe("未ログインLP（ヒーロー写真フレーム版）", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("紙レイヤーを使わず単一写真フレームを表示する", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "つながる、みつかる、変わっていく。",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("lp-paper-stage")).toHaveCount(0);

    const photoFrame = page.getByTestId("lp-hero-photo-frame");
    await expect(photoFrame).toBeVisible();
    await expect(photoFrame.locator("img")).toHaveCount(1);

    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });
});

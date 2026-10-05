import { expect, test } from "@playwright/test";

test.describe("お試し診断のキャラクター", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("15問で参考キャラクターを表示し、もう一度試せる", async ({ page }, testInfo) => {
    await page.goto("/diagnosis/trial");
    for (let question = 1; question <= 15; question++) {
      await expect(page.getByText(`質問 ${question} / 15`)).toBeVisible();
      await page.getByRole("button", { name: "どちらともいえない" }).click();
    }
    await expect(page.getByRole("heading", { name: "よりそいクマ" })).toBeVisible();
    await expect(page.getByText("あなたに近い活動スタイル（参考）")).toBeVisible();
    await expect(page.getByText(/性格を決めつけるものではなく/)).toBeVisible();
    const characterImage = page.locator('img[src*="supporter-care"]');
    await expect(characterImage).toBeVisible();
    await expect.poll(() => characterImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole("heading", { name: "よりそいクマ" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await testInfo.attach(`trial-character-${width}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }
    await page.getByRole("button", { name: "もう一度試す" }).click();
    await expect(page.getByText("質問 1 / 15")).toBeVisible();
    await expect(page.locator('img[src*="/characters/"]')).toHaveCount(0);
  });
});

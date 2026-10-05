import { findDirectionCharacter } from "../src/lib/diagnosis-scale/style-characters";
import { expect, test } from "@playwright/test";
import { classifyActivityStyle } from "../src/lib/diagnosis-scale/activity-styles";
import { getItemsInDisplayOrder, getScaleDefinition } from "../src/lib/diagnosis-scale/scale";

const neutral = classifyActivityStyle({ extraversion: 50, agreeableness: 50, conscientiousness: 50, emotionalStability: 50, intellect: 50 });
const mixed = classifyActivityStyle({ extraversion: 100, agreeableness: 100, conscientiousness: 100, emotionalStability: 100, intellect: 100 });

test.describe("お試し診断の活動スタイル", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("15問で中立結果と実測スコアを表示し、再回答の5方向混合も狭幅で読める", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.goto("/diagnosis/trial");
    for (let question = 1; question <= 15; question++) {
      await expect(page.getByText(`質問 ${question} / 15`)).toBeVisible();
      await page.getByRole("button", { name: "どちらともいえない" }).click();
    }
    await expect(page.getByRole("heading", { name: neutral.name })).toBeVisible();
    await expect(page.getByText("あなたに近い活動スタイル（参考）")).toBeVisible();
    await expect(page.getByText(/科学的に確立した性格タイプではありません/)).toBeVisible();
    await expect(page.getByText(/特に15問版は1問の影響が大きい/)).toBeVisible();
    await expect(page.getByRole("meter")).toHaveCount(5);
    await expect(page.locator('[role="meter"][aria-valuenow="50"]')).toHaveCount(5);
    await expect(page.locator('img[src*="characters"]')).toHaveCount(0);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.getByRole("heading", { name: neutral.name })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await testInfo.attach(`trial-neutral-${width}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }
    await page.getByRole("button", { name: "もう一度試す" }).click();
    await expect(page.getByText("質問 1 / 15")).toBeVisible();
    await expect(page.getByRole("meter")).toHaveCount(0);
    for (const item of getItemsInDisplayOrder(getScaleDefinition("brief"))) {
      await page.getByRole("button", { name: item.keyed === "+" ? "非常に当てはまる" : "全く当てはまらない", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: mixed.name })).toBeVisible();
    await expect(page.getByRole("list", { name: "近い方向の一覧" }).getByRole("listitem")).toHaveCount(5);
    await expect(page.locator('[role="meter"][aria-valuenow="100"]')).toHaveCount(5);
    for (const direction of mixed.directions ?? []) {
      await expect(page.getByRole("list", { name: "近い方向の一覧" }).getByText(direction.name, { exact: true })).toBeVisible();
      const character = findDirectionCharacter(direction.id)!;
      await expect(page.getByText(character.name, { exact: true })).toBeVisible();
      const image = page.locator(`img[src*="${character.imagePath.split("/").at(-1)}"]`);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    await expect(page.locator('img[src*="characters"]')).toHaveCount(5);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await testInfo.attach(`trial-mixed-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    }
    await page.getByRole("button", { name: "もう一度試す" }).click();
    for (const item of getItemsInDisplayOrder(getScaleDefinition("brief"))) {
      await page.getByRole("button", { name: item.keyed === "+" ? "全く当てはまらない" : "非常に当てはまる", exact: true }).click();
    }
    const low = classifyActivityStyle({ extraversion: 0, agreeableness: 0, conscientiousness: 0, emotionalStability: 0, intellect: 0 });
    await expect(page.locator('img[src*="characters"]')).toHaveCount(5);
    await expect(page.locator('[role="meter"][aria-valuenow="0"]')).toHaveCount(5);
    for (const direction of low.directions ?? []) {
      const character = findDirectionCharacter(direction.id)!;
      await expect(page.getByText(character.name, { exact: true })).toBeVisible();
      const image = page.locator(`img[src*="${character.imagePath.split("/").at(-1)}"]`);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await testInfo.attach(`trial-mixed-low-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    }
    await page.getByRole("button", { name: "もう一度試す" }).click();
    for (const item of getItemsInDisplayOrder(getScaleDefinition("brief"))) {
      const answer = item.domain === "extraversion"
        ? item.keyed === "+" ? "やや当てはまる" : "あまり当てはまらない"
        : "どちらともいえない";
      await page.getByRole("button", { name: answer, exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "交流のイルカ" })).toBeVisible();
    const singleImage = page.locator('img[src*="characters"]');
    await expect(singleImage).toHaveCount(1);
    await singleImage.scrollIntoViewIfNeeded();
    await expect.poll(() => singleImage.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole("meter", { name: "外向性" })).toHaveAttribute("aria-valuenow", "75");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach("trial-single-320", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });
});

import { expect, test } from "@playwright/test";

test.describe("未ログインLP（Layered Paper Waves版）", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("4つの紙レイヤーで主要セクションを構成する", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "つながる、みつかる、変わっていく。",
      }),
    ).toBeVisible();

    const paperStages = page.getByTestId("lp-paper-stage");
    await expect(paperStages).toHaveCount(4);
    for (const [index, variant] of ["hero", "journey", "styles", "trust"].entries()) {
      await expect(paperStages.nth(index)).toHaveAttribute("data-variant", variant);
    }

    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });
});

import { expect, test } from "@playwright/test";

test.describe("未ログインLP（Photo Orbit版）", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("紙レイヤーを使わずPhoto Orbitを中心に表示する", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "つながる、みつかる、変わっていく。",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("lp-paper-stage")).toHaveCount(0);

    const photoOrbit = page.getByTestId("lp-hero-photo-orbit");
    await expect(photoOrbit).toBeVisible();
    await expect(photoOrbit.locator("img")).toHaveCount(5);

    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });
});

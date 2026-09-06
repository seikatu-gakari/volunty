import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

async function expectSingleLineLabel(control: Locator) {
  const lineCounts = await control.evaluate((element) =>
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      .map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getClientRects().length;
      }),
  );
  expect(lineCounts.length).toBeGreaterThan(0);
  for (const count of lineCounts) expect(count).toBe(1);
}

test.describe("LP先頭のモバイルメニュー", () => {
  for (const width of [390, 768]) {
    test(`${width}pxでヒーローより前面のリンクを選択できる`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      // 全セクションの検証後ではなく、ヒーローが見える先頭で開く。
      await expect(page.getByRole("heading", { name: "つながる、みつかる、変わっていく。" }))
        .toBeInViewport();
      await page.getByRole("button", { name: "メニューを開く" }).click();
      const navigation = page.getByRole("navigation", { name: "モバイルナビゲーション" });
      for (const link of await navigation.getByRole("link").all()) {
        await expect(link).toBeInViewport();
        await expect.poll(() => link.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const topElement = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          );
          return topElement !== null && element.contains(topElement);
        })).toBe(true);
      }
      await navigation.getByRole("link", { name: "使い方", exact: true }).click();
      await expect(page).toHaveURL(/#usage$/);
      await expect(page.getByRole("button", { name: "メニューを開く" }))
        .toHaveAttribute("aria-expanded", "false");
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe("参加者ヘッダーのレスポンシブ表示", () => {
  test.use({ storageState: "playwright/.auth/participant.json" });

  for (const width of [390, 768, 1023]) {
    test(`${width}pxでメニューからマイページへ移動できる`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      const header = page.locator("header");
      await expect(header.getByRole("link", { name: "マイページ", exact: true })).toBeHidden();
      await header.getByRole("button", { name: "メニューを開く" }).press("Enter");
      const mypage = header.getByRole("link", { name: "マイページ", exact: true });
      await expect(mypage).toBeVisible();
      await expectSingleLineLabel(mypage);
      await expectNoHorizontalOverflow(page);
      await mypage.click();
      await expect(page).toHaveURL(/\/mypage$/);
      await expect(page.getByRole("heading", { name: "マイページ", exact: true })).toBeVisible();
      await expect(header.getByRole("button", { name: "メニューを開く" }))
        .toHaveAttribute("aria-expanded", "false");
    });
  }

  for (const width of [1024, 1440]) {
    test(`${width}pxでナビとログアウトを折り返さず表示する`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      const header = page.locator("header");
      await expect(header.getByRole("button", { name: "メニューを開く" })).toBeHidden();
      const controls = [
        ...["診断", "おすすめ案件", "マイページ"].map((name) =>
          header.getByRole("link", { name, exact: true })),
        header.getByRole("button", { name: "ログアウト", exact: true }),
      ];
      for (const control of controls) {
        await expect(control).toBeVisible();
        await expectSingleLineLabel(control);
        await expect(control).toBeInViewport({ ratio: 1 });
      }
      await expectNoHorizontalOverflow(page);
    });
  }
});

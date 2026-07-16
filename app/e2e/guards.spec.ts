import { expect, test } from "@playwright/test";

test.describe("認証・認可ガード", () => {
  test("G1: 未認証でランディングとログイン導線を表示する", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /つながる/ })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "ログイン" })).toBeVisible();
  });

  test("G2: 未認証で団体ダッシュボードへ進むとログインへ戻す", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });
});

test.describe("未ログインLP（モバイル）", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("主要コンテンツと操作導線を一画面幅で利用できる", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "ボランティー ホーム" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "つながる、みつかる、変わっていく。" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /無料で簡易診断を試す/ }).first()).toHaveAttribute(
      "href",
      "/diagnosis/trial",
    );

    await page.getByRole("button", { name: "メニューを開く" }).click();
    const mobileNavigation = page.getByRole("navigation", { name: "モバイルナビゲーション" });
    await expect(mobileNavigation).toBeVisible();
    await mobileNavigation.getByRole("link", { name: "よくある質問" }).click();
    await expect(page).toHaveURL(/#faq$/);

    const secondQuestion = page.getByRole("button", {
      name: "診断はどのくらい時間がかかりますか？",
    });
    await secondQuestion.click();
    await expect(secondQuestion).toHaveAttribute("aria-expanded", "true");

    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      )
      .toBe(true);
  });
});

test.describe("ロール越境ガード", () => {
  test.use({ storageState: "playwright/.auth/participant.json" });

  test("G3: 参加者で管理画面へ進むとアクセス拒否になる", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(
      page.getByRole("heading", { name: "このページにはアクセスできません" })
    ).toBeVisible();
  });
});

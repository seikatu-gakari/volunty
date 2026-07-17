import { expect, test } from "@playwright/test";

const LP_SECTION_IDS = [
  "styles",
  "kadai",
  "usage",
  "types",
  "benefits",
  "voices",
  "features",
  "faq",
  "start",
] as const;

async function expectLandingPageIntegrity(
  page: import("@playwright/test").Page,
  viewportWidth: number,
) {
  const sections = [
    { name: "hero", locator: page.locator("main > section").first() },
    ...LP_SECTION_IDS.map((sectionId) => ({
      name: sectionId,
      locator: page.locator(`#${sectionId}`),
    })),
  ];
  expect(sections).toHaveLength(10);

  for (const section of sections) {
    const { locator } = section;
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeVisible();

    const rect = await locator.boundingBox();
    expect(rect, `${section.name} の境界を取得できる`).not.toBeNull();
    expect(rect!.x, `${section.name} の左端がviewport内`).toBeGreaterThanOrEqual(-1);
    expect(rect!.x + rect!.width, `${section.name} の右端がviewport内`).toBeLessThanOrEqual(
      viewportWidth + 1,
    );
  }

  const images = page.locator("main img");
  await expect(images).toHaveCount(21);

  const photoOrbit = page.getByTestId("lp-hero-photo-orbit");
  await expect(photoOrbit.locator("img")).toHaveCount(5);
  await expect
    .poll(() =>
      images.evaluateAll((elements) =>
        elements.every((element) => {
          const image = element as HTMLImageElement;
          return image.complete && image.naturalWidth > 0;
        }),
      ),
    )
    .toBe(true);

  const trialLinks = page.getByRole("link", { name: "無料で簡易診断を試す" });
  await expect(trialLinks).toHaveCount(2);
  await expect(trialLinks.first()).toHaveAttribute("href", "/diagnosis/trial");
  await expect(trialLinks.last()).toHaveAttribute("href", "/diagnosis/trial");

  const opportunityLinks = page.getByRole("link", { name: "募集中の活動を見る" });
  await expect(opportunityLinks).toHaveCount(2);
  await expect(opportunityLinks.first()).toHaveAttribute("href", "/opportunities");
  await expect(opportunityLinks.last()).toHaveAttribute("href", "/opportunities");

  const styleLinks = page.getByRole("link", { name: "診断で詳しく見る" });
  await expect(styleLinks).toHaveCount(4);
  for (const link of await styleLinks.all()) {
    await expect(link).toHaveAttribute("href", "/diagnosis/trial");
  }

  await expect(page.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

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

    await expectLandingPageIntegrity(page, 390);

    const primaryCTA = page.getByRole("link", { name: "無料で簡易診断を試す" }).first();
    const photoOrbit = page.getByTestId("lp-hero-photo-orbit");
    const [ctaBox, orbitBox] = await Promise.all([
      primaryCTA.boundingBox(),
      photoOrbit.boundingBox(),
    ]);
    expect(ctaBox).not.toBeNull();
    expect(orbitBox).not.toBeNull();
    expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(orbitBox!.y + 1);

    await page.getByRole("button", { name: "メニューを開く" }).click();
    const mobileNavigation = page.getByRole("navigation", { name: "モバイルナビゲーション" });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole("link", { name: "無料で始める" })).toHaveAttribute(
      "href",
      "/signup",
    );
    await mobileNavigation.getByRole("link", { name: "よくある質問" }).click();
    await expect(page).toHaveURL(/#faq$/);

    const secondQuestion = page.getByRole("button", {
      name: "診断はどのくらい時間がかかりますか？",
    });
    await secondQuestion.click();
    await expect(secondQuestion).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("未ログインLP（タブレット・デスクトップ）", () => {
  for (const viewport of [
    { width: 768, height: 1024, headerMode: "mobile" },
    { width: 1440, height: 1000, headerMode: "desktop" },
  ] as const) {
    test(`${viewport.width}pxで全セクション・画像・主要導線を安定表示する`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");

      await expectLandingPageIntegrity(page, viewport.width);

      const menuButton = page.getByRole("button", { name: "メニューを開く" });
      const desktopNavigation = page.locator('header > div > nav a[href="#usage"]');
      const desktopSignup = page.getByRole("link", { name: "無料で始める", exact: true });
      if (viewport.headerMode === "mobile") {
        await expect(menuButton).toBeVisible();
        await expect(desktopNavigation).toBeHidden();
        await expect(desktopSignup).toBeHidden();
      } else {
        await expect(menuButton).toBeHidden();
        await expect(desktopNavigation).toBeVisible();
        await expect(desktopSignup).toBeVisible();
        await expect(desktopSignup).toHaveAttribute("href", "/signup");
      }
    });
  }
});

test.describe("非LP未認証ヘッダー", () => {
  test("/loginではLPアンカーとモバイルメニューを表示しない", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator('header a[href^="#"]')).toHaveCount(0);
    for (const sectionId of LP_SECTION_IDS) {
      await expect(page.locator(`#${sectionId}`)).toHaveCount(0);
    }
    await expect(
      page.getByRole("heading", { name: "つながる、みつかる、変わっていく。" }),
    ).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "モバイルナビゲーション" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "メニューを開く" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "ログイン", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Googleでログイン" })).toBeVisible();
  });
});

test.describe("認証済みホームヘッダー", () => {
  test.use({ storageState: "playwright/.auth/participant.json" });

  test("参加者ホームではLP固有要素を表示せず認証済み導線を表示する", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('header a[href^="#"]')).toHaveCount(0);
    await expect(page.locator(LP_SECTION_IDS.map((id) => `main #${id}`).join(", "))).toHaveCount(
      0,
    );
    await expect(page.locator('main a[href^="#"]')).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "つながる、みつかる、変わっていく。" }),
    ).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "モバイルナビゲーション" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "診断", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "おすすめ案件", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "マイページ", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E participant-onboardedさん" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "応募者メニュー" })).toBeVisible();
  });
});

test.describe("公開ヘッダーのブレークポイント", () => {
  async function expectHeaderFitsViewport(page: import("@playwright/test").Page) {
    const metrics = await page.locator("header > div").evaluate((header) => {
      const rect = header.getBoundingClientRect();
      return {
        clientHeight: header.clientHeight,
        left: rect.left,
        right: rect.right,
        scrollHeight: header.scrollHeight,
        viewportWidth: window.innerWidth,
      };
    });

    expect(metrics.left).toBeGreaterThanOrEqual(-1);
    expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  }

  test("1023pxと1024pxでモバイル・デスクトップ導線を切り替える", async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("button", { name: "メニューを開く" })).toBeVisible();
    await expect(page.locator('header > div > nav a[href="#usage"]')).toBeHidden();
    await expectHeaderFitsViewport(page);

    await page.setViewportSize({ width: 1024, height: 844 });

    await expect(page.getByRole("button", { name: "メニューを開く" })).toBeHidden();
    await expect(page.locator('header > div > nav a[href="#usage"]')).toBeVisible();
    await expect(page.getByRole("link", { name: "無料で始める", exact: true })).toHaveAttribute(
      "href",
      "/signup",
    );
    await expectHeaderFitsViewport(page);
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

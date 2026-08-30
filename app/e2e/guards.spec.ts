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

  const usageSection = page.locator("#usage");
  await expect(
    usageSection.getByRole("heading", { name: "はじめるのは、かんたん3ステップ。" }),
  ).toBeVisible();
  const usageCards = usageSection.locator("article");
  await expect(usageCards).toHaveCount(3);
  for (const title of ["性格傾向チェック・登録", "マッチング", "参加・つながり"]) {
    await expect(usageSection.getByRole("heading", { name: title })).toBeVisible();
  }
  for (const removedText of [
    "BIG FIVE",
    "5つの性格傾向をわかりやすく",
    "YOUR STYLE",
    "サポーター・ケア傾向",
  ]) {
    await expect(usageSection.getByText(removedText, { exact: true })).toHaveCount(0);
  }

  const usageCardBoxes = await usageCards.evaluateAll((cards) =>
    cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    }),
  );
  if (viewportWidth >= 1024) {
    expect(usageCardBoxes[0].y).toBeCloseTo(usageCardBoxes[1].y, 0);
    expect(usageCardBoxes[1].y).toBeCloseTo(usageCardBoxes[2].y, 0);
    expect(usageCardBoxes[0].x).toBeLessThan(usageCardBoxes[1].x);
    expect(usageCardBoxes[1].x).toBeLessThan(usageCardBoxes[2].x);
  } else {
    expect(usageCardBoxes[0].x).toBeCloseTo(usageCardBoxes[1].x, 0);
    expect(usageCardBoxes[1].x).toBeCloseTo(usageCardBoxes[2].x, 0);
    expect(usageCardBoxes[0].y).toBeLessThan(usageCardBoxes[1].y);
    expect(usageCardBoxes[1].y).toBeLessThan(usageCardBoxes[2].y);
  }

  const images = page.locator("main img");
  await expect(images).toHaveCount(17);

  const photoFrame = page.getByTestId("lp-hero-photo-frame");
  await expect(photoFrame.locator("img")).toHaveCount(1);
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

  const heroTrialLink = page.getByRole("link", { name: "2分で自分の活動タイプを知る" });
  await expect(heroTrialLink).toHaveCount(1);
  await expect(heroTrialLink).toHaveAttribute("href", "/diagnosis/trial");

  const bottomTrialLink = page.getByRole("link", { name: "無料で簡易診断を試す" });
  await expect(bottomTrialLink).toHaveCount(1);
  await expect(bottomTrialLink).toHaveAttribute("href", "/diagnosis/trial");

  const heroStylesLink = page.getByRole("link", { name: "活動例を見る" });
  await expect(heroStylesLink).toHaveCount(1);
  await expect(heroStylesLink).toHaveAttribute("href", "#styles");

  const bottomOpportunityLink = page.getByRole("link", { name: "募集中の活動を見る" });
  await expect(bottomOpportunityLink).toHaveCount(1);
  await expect(bottomOpportunityLink).toHaveAttribute("href", "/opportunities");

  const styleLinks = page.getByRole("link", { name: "診断で詳しく見る" });
  await expect(styleLinks).toHaveCount(4);
  for (const link of await styleLinks.all()) {
    await expect(link).toHaveAttribute("href", "/diagnosis/trial");
  }

  if (viewportWidth >= 1024) {
    await expect(page.getByRole("link", { name: "ログイン" })).toHaveAttribute("href", "/login");
  }
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

test.describe("未ログインLP導線", () => {
  test("LPから簡易診断を完走できる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "2分で自分の活動タイプを知る" }).click();

    await expect(page).toHaveURL(/\/diagnosis\/trial$/);
    await expect(
      page.getByRole("heading", { name: "簡易診断を試す" })
    ).toBeVisible();
    await expect(page.getByText("質問 1 / 15")).toBeVisible();

    for (let question = 1; question <= 15; question += 1) {
      await expect(page.getByText(`質問 ${question} / 15`)).toBeVisible();
      await page.getByRole("button", { name: "どちらともいえない" }).click();
    }

    await expect(page.getByText("お試し結果", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "登録して結果を活用する" })
    ).toBeVisible();
  });

  test("LPから公開募集一覧を閲覧でき、詳細はログインへ送る", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "募集中の活動を見る" }).click();

    await expect(page).toHaveURL(/\/opportunities$/);
    await expect(
      page.getByRole("heading", { name: "活動を探す" })
    ).toBeVisible();
    await expect(page.getByText("E2E 応募対象案件")).toBeVisible();

    await page.getByRole("link", { name: "E2E 応募対象案件" }).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/login" &&
        (url.searchParams.get("next")?.startsWith("/opportunities/") ?? false)
    );
  });

  test("未認証の本診断はログインへ戻す", async ({ page }) => {
    await page.goto("/diagnosis");

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/login" && url.searchParams.get("next") === "/diagnosis"
    );
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

    const primaryCTA = page.getByRole("link", { name: "2分で自分の活動タイプを知る" });
    const secondaryCTA = page.getByRole("link", { name: "活動例を見る" });
    const photoFrame = page.getByTestId("lp-hero-photo-frame");
    const trustItem = page.getByText("登録・診断は無料").first();
    const [ctaBox, secondaryBox, frameBox, trustBox] = await Promise.all([
      primaryCTA.boundingBox(),
      secondaryCTA.boundingBox(),
      photoFrame.boundingBox(),
      trustItem.boundingBox(),
    ]);
    expect(ctaBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect(trustBox).not.toBeNull();
    expect(frameBox!.y + frameBox!.height).toBeLessThanOrEqual(ctaBox!.y + 1);
    expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(secondaryBox!.y + 1);
    expect(secondaryBox!.y + secondaryBox!.height).toBeLessThanOrEqual(trustBox!.y + 1);

    await expect(page.getByText("スマホ対応")).toBeVisible();
    await expect(page.getByText("スマホ・PC対応")).toBeHidden();
    await expect(page.getByRole("link", { name: "ログイン" })).toBeHidden();

    await page.getByRole("button", { name: "メニューを開く" }).click();
    const mobileNavigation = page.getByRole("navigation", { name: "モバイルナビゲーション" });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole("link", { name: "無料で始める" })).toHaveAttribute(
      "href",
      "/signup",
    );
    await expect(mobileNavigation.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
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

        await expect(page.getByText("スマホ・PC対応")).toBeVisible();
        await expect(page.getByText("スマホ対応")).toBeHidden();

        const frameBox = await page.getByTestId("lp-hero-photo-frame").boundingBox();
        const headingBox = await page
          .getByRole("heading", { name: "つながる、みつかる、変わっていく。" })
          .boundingBox();
        const primaryBox = await page
          .getByRole("link", { name: "2分で自分の活動タイプを知る" })
          .boundingBox();
        const trustBox = await page.getByText("登録・診断は無料").first().boundingBox();
        const assuranceBox = await page.getByTestId("lp-hero-assurance").boundingBox();
        const heroBox = await page.locator("main > section").first().boundingBox();
        expect(frameBox).not.toBeNull();
        expect(headingBox).not.toBeNull();
        expect(primaryBox).not.toBeNull();
        expect(trustBox).not.toBeNull();
        expect(assuranceBox).not.toBeNull();
        expect(heroBox).not.toBeNull();
        expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(frameBox!.x + 1);
        expect(primaryBox!.x + primaryBox!.width).toBeLessThanOrEqual(frameBox!.x + 1);
        expect(trustBox!.x + trustBox!.width).toBeLessThanOrEqual(frameBox!.x + 1);
        expect(assuranceBox!.y + assuranceBox!.height).toBeLessThanOrEqual(heroBox!.y + heroBox!.height + 1);
      }
    });
  }
});

test.describe("未ログインLP（横向き短高）", () => {
  test.use({ viewport: { width: 568, height: 320 } });

  test("短いviewportでもモバイルメニュー最下部CTAへ到達できる", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "メニューを開く" }).click();

    const mobileNavigation = page.getByRole("navigation", {
      name: "モバイルナビゲーション",
    });
    const mobileMenu = mobileNavigation.locator("xpath=..");
    const signup = mobileNavigation.getByRole("link", { name: "無料で始める" });
    await expect(mobileNavigation).toBeVisible();

    const menuMetrics = await mobileMenu.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: style.overflowY,
      };
    });
    expect(menuMetrics.overflowY).toBe("auto");
    expect(menuMetrics.scrollHeight).toBeGreaterThan(menuMetrics.clientHeight);

    await signup.scrollIntoViewIfNeeded();
    const signupBox = await signup.boundingBox();
    expect(signupBox).not.toBeNull();
    expect(signupBox!.y).toBeGreaterThanOrEqual(0);
    expect(signupBox!.y + signupBox!.height).toBeLessThanOrEqual(321);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
  });
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

    const thirdHeroLineMetrics = await page
      .getByRole("heading", { name: "つながる、みつかる、変わっていく。" })
      .locator(":scope > span")
      .nth(2)
      .evaluate((line) => {
        const lineHeight = Number.parseFloat(getComputedStyle(line).lineHeight);
        return {
          height: line.getBoundingClientRect().height,
          lineHeight,
        };
      });
    expect(thirdHeroLineMetrics.height).toBeLessThanOrEqual(
      thirdHeroLineMetrics.lineHeight * 1.1,
    );

    const heroBox = await page.locator("main > section").first().boundingBox();
    const [primaryBox, secondaryBox, frameBox] = await Promise.all([
      page.getByRole("link", { name: "2分で自分の活動タイプを知る" }).boundingBox(),
      page.getByRole("link", { name: "活動例を見る" }).boundingBox(),
      page.getByTestId("lp-hero-photo-frame").boundingBox(),
    ]);
    expect(heroBox).not.toBeNull();
    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect(Math.abs(primaryBox!.y - secondaryBox!.y)).toBeLessThanOrEqual(1);
    expect(primaryBox!.x).toBeLessThan(secondaryBox!.x);
    for (const [name, box] of [
      ["primary CTA", primaryBox!],
      ["secondary CTA", secondaryBox!],
    ] as const) {
      expect(box.x, `${name} の左端がhero内`).toBeGreaterThanOrEqual(heroBox!.x - 1);
      expect(box.x + box.width, `${name} の右端がhero内`).toBeLessThanOrEqual(
        heroBox!.x + heroBox!.width + 1,
      );
      expect(box.x + box.width, `${name} が写真と重ならない`).toBeLessThanOrEqual(
        frameBox!.x + 1,
      );
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
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

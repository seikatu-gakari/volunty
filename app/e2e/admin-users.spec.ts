import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

import { authStatePath } from "../test-support/playwright-auth-state";

const USER_SUSPENDABLE_NAME = "E2E user-suspendable";
const USER_SUSPENDABLE_EMAIL = "e2e-user-suspendable@example.com";
const ADMIN_REVIEW_EMAIL = "e2e-admin-review@example.com";
const ORGANIZATION_REVIEW_APPROVE_EMAIL =
  "e2e-org-review-approve@example.com";

function suspendableUserCard(page: Page): Locator {
  return page.getByRole("article", {
    name: new RegExp(USER_SUSPENDABLE_EMAIL),
  });
}

async function openSuspendableUser(page: Page): Promise<Locator> {
  await page.goto("/admin/users");
  await page.getByLabel("検索").fill(USER_SUSPENDABLE_EMAIL);
  const userCard = suspendableUserCard(page);
  await expect(userCard).toBeVisible();
  return userCard;
}

async function ensureSuspendableUserActive(page: Page) {
  const userCard = await openSuspendableUser(page);
  const reactivateButton = userCard.getByRole("button", {
    name: "凍結を解除",
  });

  if (await reactivateButton.isVisible().catch(() => false)) {
    await reactivateButton.click();
    await expect(userCard.getByText("停止中")).toHaveCount(0);
  }
}

test.describe("管理者ユーザー管理", () => {
  test.use({ storageState: authStatePath("admin.json") });

  test("A-E1: 名前/メール検索とロールフィルターとゼロ状態を確認する", async ({
    page,
  }) => {
    await page.goto("/admin/users");

    await page.getByLabel("検索").fill(USER_SUSPENDABLE_NAME);
    await expect(page.getByText(USER_SUSPENDABLE_EMAIL)).toBeVisible();

    await page.getByLabel("検索").fill(ADMIN_REVIEW_EMAIL);
    await expect(page.getByText(ADMIN_REVIEW_EMAIL)).toBeVisible();

    await page.getByLabel("検索").fill("");
    await page.getByRole("button", { name: /参加者/ }).click();
    await expect(page.getByText(USER_SUSPENDABLE_EMAIL)).toBeVisible();
    await expect(page.getByText(ORGANIZATION_REVIEW_APPROVE_EMAIL)).toHaveCount(
      0
    );
    await expect(page.getByText(ADMIN_REVIEW_EMAIL)).toHaveCount(0);

    await page.getByRole("button", { name: /団体/ }).click();
    await expect(
      page.getByText(ORGANIZATION_REVIEW_APPROVE_EMAIL)
    ).toBeVisible();
    await expect(page.getByText(USER_SUSPENDABLE_EMAIL)).toHaveCount(0);

    await page.getByRole("button", { name: /管理者/ }).click();
    await expect(page.getByText(ADMIN_REVIEW_EMAIL)).toBeVisible();
    await expect(page.getByText(USER_SUSPENDABLE_EMAIL)).toHaveCount(0);

    await page.getByLabel("検索").fill("E2E存在しないユーザー");
    await expect(
      page.getByText("条件に一致するユーザーはありません")
    ).toBeVisible();
  });
});

test.describe("管理者ユーザー凍結", () => {
  test.use({ storageState: authStatePath("admin-review.json") });

  test("A-E6: 凍結ユーザーはユーザー側で利用できず解除後に再利用できる", async ({
    page,
    browser,
  }) => {
    let suspendedContext: BrowserContext | undefined;

    try {
      const userCard = await openSuspendableUser(page);
      await userCard.getByRole("button", { name: "凍結する" }).click();
      await userCard
        .getByPlaceholder("凍結理由を入力してください")
        .fill("A-E6 凍結ユーザー側確認");
      await userCard.getByRole("button", { name: "凍結を確定" }).click();
      await expect(userCard.getByText("停止中")).toBeVisible();

      suspendedContext = await browser.newContext({
        storageState: authStatePath("user-suspendable.json"),
      });
      const suspendedPage = await suspendedContext.newPage();
      await suspendedPage.goto("/mypage");
      await expect(suspendedPage).toHaveURL(/\/login\?error=suspended/);
      await expect(
        suspendedPage.getByRole("alert", {
          name: "このアカウントは凍結されています。",
        })
      ).toBeVisible();
    } finally {
      await suspendedContext?.close();
      await ensureSuspendableUserActive(page);
    }

    const reactivatedContext = await browser.newContext();
    try {
      const reactivatedPage = await reactivatedContext.newPage();
      await reactivatedPage.goto(
        "/api/test-auth/login?persona=user-suspendable&next=/mypage"
      );
      await expect(reactivatedPage).toHaveURL(/\/mypage$/);
      await expect(
        reactivatedPage.getByRole("heading", { name: "マイページ" })
      ).toBeVisible();
    } finally {
      await reactivatedContext.close();
    }
  });
});

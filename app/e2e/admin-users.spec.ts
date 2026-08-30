import {
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { resolve } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const USER_SUSPENDABLE_NAME = "E2E user-suspendable";
const USER_SUSPENDABLE_EMAIL = "e2e-user-suspendable@example.com";
const ADMIN_REVIEW_EMAIL = "e2e-admin-review@example.com";
const ORGANIZATION_REVIEW_APPROVE_EMAIL =
  "e2e-org-review-approve@example.com";
const DELETION_PENDING_EMAIL =
  "e2e-participant-deletion-pending@example.com";

async function countPendingDeletionRows() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ users: string; requests: string }>(
      `SELECT
         (SELECT COUNT(*) FROM m_user WHERE email = $1) AS users,
         (SELECT COUNT(*) FROM t_account_deletion_request r
            JOIN m_user u ON u.id = r.user_id
           WHERE u.email = $1) AS requests`,
      [DELETION_PENDING_EMAIL]
    );
    return {
      users: Number(rows[0].users),
      requests: Number(rows[0].requests),
    };
  } finally {
    await client.end();
  }
}

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
  test.use({ storageState: "playwright/.auth/admin.json" });

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

  test("A-E7: cleanup 保留台帳を確認して冪等に再処理できる", async ({ page }) => {
    expect(await countPendingDeletionRows()).toEqual({ users: 1, requests: 1 });

    await page.goto("/admin/users");
    const pendingSection = page.getByRole("heading", {
      name: /削除処理保留（1件）/,
    });
    await expect(pendingSection).toBeVisible();
    await expect(page.getByText("E2E 削除処理保留参加者")).toBeVisible();

    await page.getByRole("button", { name: "再処理" }).click();

    await expect(pendingSection).toHaveCount(0);
    expect(await countPendingDeletionRows()).toEqual({ users: 0, requests: 0 });
  });
});

test.describe("管理者ユーザー凍結", () => {
  test.use({ storageState: "playwright/.auth/admin-review.json" });

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
        storageState: "playwright/.auth/user-suspendable.json",
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

import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

const STORAGE_STATE = "playwright/.auth/organization-lifecycle.json";
const JST_PUBLICATION_VALUE = "2099-12-31T10:00";
const JST_PUBLICATION_ISO = "2099-12-31T01:00:00.000Z";
const PAST_PUBLICATION_VALUE = "2000-01-01T10:00";
const PAST_PUBLICATION_ERROR =
  "公開予約日時は現在より後の日時を指定してください";

test.use({ storageState: STORAGE_STATE });

async function findOpportunity(title: string) {
  return prisma.opportunity.findFirst({
    where: { title },
    select: { id: true, status: true, publishedAt: true },
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe("公開予約", () => {
  test("新規・複製作成でJST入力を同じUTC日時として保存する", async ({
    browser,
  }) => {
    const createdOpportunityIds: string[] = [];

    try {
      for (const timezoneId of [
        "UTC",
        "Asia/Tokyo",
        "America/Los_Angeles",
      ]) {
        const context = await browser.newContext({
          storageState: STORAGE_STATE,
          timezoneId,
        });
        const page = await context.newPage();
        const title = `E2E 公開予約 ${timezoneId} ${Date.now()}`;

        await page.goto("/dashboard/opportunities/new");
        await page.getByLabel("案件タイトル").fill(title);
        await page.getByLabel("案件説明").fill("JSTの公開予約を確認するE2E案件です。");
        await page.getByRole("radio", { name: "公開予約" }).check();
        await page
          .getByLabel("公開日時（日本時間）")
          .fill(JST_PUBLICATION_VALUE);
        await page.getByRole("button", { name: "作成する" }).click();
        await expect(page).toHaveURL(/\/dashboard$/);

        await expect.poll(() => findOpportunity(title)).not.toBeNull();
        const createdOpportunity = await findOpportunity(title);
        expect(createdOpportunity).not.toBeNull();
        expect(createdOpportunity?.status).toBe("published");
        expect(createdOpportunity?.publishedAt?.toISOString()).toBe(
          JST_PUBLICATION_ISO,
        );
        if (createdOpportunity) {
          createdOpportunityIds.push(createdOpportunity.id);
        }

        if (timezoneId === "UTC" && createdOpportunity) {
          const copyLink = page.locator(
            `a[href="/dashboard/opportunities/new?copyFrom=${createdOpportunity.id}"]`,
          );
          await expect(copyLink).toBeVisible();
          await copyLink.click();
          await expect(page).toHaveURL(
            new RegExp(
              `/dashboard/opportunities/new\\?copyFrom=${createdOpportunity.id}`,
            ),
          );
          await expect(
            page.getByRole("radio", { name: "下書き保存" }),
          ).toBeChecked();
          await expect(
            page.getByLabel("公開日時（日本時間）"),
          ).toHaveCount(0);

          const copiedTitle = `${title}（コピー）`;
          await expect(page.getByLabel("案件タイトル")).toHaveValue(
            copiedTitle,
          );
          await page.getByRole("radio", { name: "公開予約" }).check();
          await page
            .getByLabel("公開日時（日本時間）")
            .fill(JST_PUBLICATION_VALUE);
          await page.getByRole("button", { name: "作成する" }).click();
          await expect(page).toHaveURL(/\/dashboard$/);

          await expect
            .poll(() => findOpportunity(copiedTitle))
            .not.toBeNull();
          const copiedOpportunity = await findOpportunity(copiedTitle);
          expect(copiedOpportunity?.status).toBe("published");
          expect(copiedOpportunity?.publishedAt?.toISOString()).toBe(
            JST_PUBLICATION_ISO,
          );
          if (copiedOpportunity) {
            createdOpportunityIds.push(copiedOpportunity.id);
          }
        }

        await context.close();
      }
    } finally {
      if (createdOpportunityIds.length > 0) {
        await prisma.opportunity.deleteMany({
          where: { id: { in: createdOpportunityIds } },
        });
      }
    }
  });

  test("サーバー側で過去日時を拒否し、案件を保存しない", async ({ page }) => {
    const title = `E2E 公開予約 過去日時 ${Date.now()}`;

    await page.goto("/dashboard/opportunities/new");
    await page.getByLabel("案件タイトル").fill(title);
    await page.getByLabel("案件説明").fill("過去日時の拒否を確認するE2E案件です。");
    await page.getByRole("radio", { name: "公開予約" }).check();
    const publishedAtInput = page.getByLabel("公開日時（日本時間）");
    await publishedAtInput.evaluate((input) => input.removeAttribute("min"));
    await publishedAtInput.fill(PAST_PUBLICATION_VALUE);
    await page.getByRole("button", { name: "作成する" }).click();

    await expect(page.locator("#publishedAt-error")).toHaveText(
      PAST_PUBLICATION_ERROR,
    );
    await expect(publishedAtInput).toHaveValue(PAST_PUBLICATION_VALUE);
    await expect(publishedAtInput).toBeFocused();
    await expect.poll(() => findOpportunity(title)).toBeNull();
  });
});

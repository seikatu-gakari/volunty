import { expect, test } from "@playwright/test";

const APPLICATION_OPPORTUNITY_TITLE = "E2E 応募対象案件";
const ORGANIZATION_FLOW_OPPORTUNITY_TITLE = "E2E 団体フロー案件";

test.describe("未完了参加者", () => {
  test.use({ storageState: "playwright/.auth/participant-fresh.json" });

  test("P1: オンボーディング未完了なら利用方法選択へ進む", async ({ page }) => {
    await page.goto("/onboarding/role");

    await expect(page).toHaveURL(/\/onboarding\/role$/);
    await expect(
      page.getByRole("heading", { name: "利用方法を選択" })
    ).toBeVisible();
  });
});

test.describe("診断済み参加者", () => {
  test.use({ storageState: "playwright/.auth/participant.json" });

  test("P2: おすすめ案件を1件以上表示する", async ({ page }) => {
    await page.goto("/recommendations");

    await expect(
      page.getByRole("heading", { name: "おすすめ案件" })
    ).toBeVisible();
    await expect(page.getByText(APPLICATION_OPPORTUNITY_TITLE)).toBeVisible();
  });

  test("P3: 案件へ応募してマイページに反映する", async ({ page }) => {
    await page.goto("/recommendations");
    await page
      .getByRole("link", { name: new RegExp(APPLICATION_OPPORTUNITY_TITLE) })
      .click();

    await expect(
      page.getByRole("heading", { name: APPLICATION_OPPORTUNITY_TITLE })
    ).toBeVisible();
    await page
      .getByLabel("応募メッセージ")
      .fill("Playwright E2Eからの応募です");
    await page.getByRole("button", { name: "応募する" }).click();
    await expect(page.getByText(/応募が完了しました/)).toBeVisible();

    await page.goto("/mypage");
    await expect(page.getByText(APPLICATION_OPPORTUNITY_TITLE)).toBeVisible();
  });

  test("P4: マイページにプロフィールと応募一覧を表示する", async ({ page }) => {
    await page.goto("/mypage");

    await expect(
      page.getByRole("heading", { name: "プロフィール" })
    ).toBeVisible();
    await expect(page.getByText("E2E 参加者(診断済)")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "応募一覧" })
    ).toBeVisible();
    await expect(page.getByText(ORGANIZATION_FLOW_OPPORTUNITY_TITLE)).toBeVisible();
  });
});

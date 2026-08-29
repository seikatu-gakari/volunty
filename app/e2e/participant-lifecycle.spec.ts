import { stat } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

import { authStatePath } from "../test-support/playwright-auth-state";

const PENDING_APPLICATION_TITLE = "E2E 審査中応募案件";
const ACCEPTED_APPLICATION_TITLE = "E2E 成立済み応募案件";
const CERTIFICATE_REQUEST_TITLE = "E2E 証明書申請対象案件";
const CERTIFICATE_PENDING_TITLE = "E2E 申請中証明書案件";
const CERTIFICATE_ISSUED_TITLE = "E2E 発行済み証明書案件";
const CERTIFICATE_REJECTED_TITLE = "E2E 却下済み証明書案件";
const APPROACH_ACCEPT_TITLE = "E2E 承諾対象アプローチ案件";
const APPROACH_DECLINE_TITLE = "E2E 辞退対象アプローチ案件";
const APPROACH_EXPIRED_TITLE = "E2E 期限切れアプローチ案件";

function applicationCard(page: Page, title: string) {
  return page
    .getByRole("heading", { name: title })
    .locator("xpath=../../..");
}

test.describe.serial("参加者の応募後ライフサイクル", () => {
  test.use({ storageState: authStatePath("participant-lifecycle.json") });

  test("P-8/P-11: 審査中は連絡先を非表示、成立後はLINE連絡先を表示する", async ({
    page,
  }) => {
    await page.goto("/mypage");
    await applicationCard(page, PENDING_APPLICATION_TITLE)
      .getByRole("link", { name: "詳細を見る" })
      .click();
    await expect(page.getByText("審査中", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "団体連絡先" })).toHaveCount(0);
    await expect(page.getByText("@volunty-e2e", { exact: true })).toHaveCount(0);

    await page.goto("/mypage");
    await applicationCard(page, ACCEPTED_APPLICATION_TITLE)
      .getByRole("link", { name: "詳細を見る" })
      .click();
    await expect(page.getByText("マッチング成立", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "団体連絡先" })).toBeVisible();
    await expect(page.getByText("@volunty-e2e", { exact: true })).toBeVisible();
  });

  test("P-9/P-10/P-11: アプローチを確認・承諾して連絡先を表示できる", async ({ page }) => {
    await page.goto("/mypage/approaches");
    await page.getByRole("link", { name: new RegExp(APPROACH_ACCEPT_TITLE) }).click();
    await page.getByRole("button", { name: "承諾する" }).click();

    await expect(page.getByText("承諾済み", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "団体連絡先" })).toBeVisible();
    await expect(page.getByText("@volunty-e2e", { exact: true })).toBeVisible();
  });

  test("P-10: アプローチを辞退できる", async ({ page }) => {
    await page.goto("/mypage/approaches");
    await page.getByRole("link", { name: new RegExp(APPROACH_DECLINE_TITLE) }).click();
    await page.getByRole("button", { name: "辞退する" }).click();

    await expect(page.getByText("辞退済み", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "団体連絡先" })).toHaveCount(0);
  });

  test("P-9/P-10: 期限切れアプローチには回答できない", async ({ page }) => {
    await page.goto("/mypage/approaches");
    await page.getByRole("link", { name: new RegExp(APPROACH_EXPIRED_TITLE) }).click();

    await expect(page.getByText("期限切れ", { exact: true })).toBeVisible();
    await expect(page.getByText(/回答期限を過ぎているため/)).toBeVisible();
    await expect(page.getByRole("button", { name: "承諾する" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "辞退する" })).toHaveCount(0);
  });

  test("P-12: 活動完了済み応募から参加証明書を申請できる", async ({ page }) => {
    await page.goto("/mypage");
    await applicationCard(page, CERTIFICATE_REQUEST_TITLE)
      .getByRole("link", { name: "証明書を申請" })
      .click();
    await page.getByRole("button", { name: "証明書を申請する" }).click();

    await page.getByRole("link", { name: "申請状況を見る" }).click();
    await expect(
      page.getByRole("heading", { name: CERTIFICATE_REQUEST_TITLE })
    ).toBeVisible();
    await expect(page.getByText("申請中", { exact: true })).toBeVisible();
  });

  test("P-13: 証明書の申請中・発行済み・却下を確認しPDFを保存できる", async ({
    page,
  }) => {
    await page.goto("/mypage/certificates");
    await expect(page.getByText(CERTIFICATE_REQUEST_TITLE)).toBeVisible();
    await expect(page.getByText(CERTIFICATE_PENDING_TITLE)).toBeVisible();
    await expect(page.getByText(CERTIFICATE_ISSUED_TITLE)).toBeVisible();
    await expect(page.getByText(CERTIFICATE_REJECTED_TITLE)).toBeVisible();

    await page
      .getByRole("link", { name: new RegExp(CERTIFICATE_ISSUED_TITLE) })
      .click();
    await expect(page.getByText("発行済み", { exact: true })).toBeVisible();
    await expect(page.getByText("VOL-E2E-ISSUED", { exact: true })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "PDFをダウンロード" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("VOL-E2E-ISSUED.pdf");
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    expect((await stat(downloadPath!)).size).toBeGreaterThan(0);
  });
});

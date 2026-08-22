import { expect, test } from "@playwright/test";

test.describe("団体オンボーディング", () => {
  test.use({ storageState: "playwright/.auth/organization-fresh.json" });

  test("O-E1: 団体ロールを選び審査を申請できる", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding\/role$/);
    await expect(
      page.getByRole("heading", { name: "利用方法を選択" })
    ).toBeVisible();

    await page.getByRole("button", { name: /ボランティアを募集する/ }).click();
    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page).toHaveURL(/\/onboarding\/organization$/);

    await page.getByLabel("団体名").fill("E2E新規団体");
    await page.getByLabel("代表者名").fill("E2E 新規代表者");
    await page
      .getByLabel("連絡先メールアドレス")
      .fill("e2e-org-fresh@example.com");
    await page.getByText("東京都", { exact: true }).click();
    await page.getByLabel("LINE公式アカウントID").fill("@e2e-fresh");
    await page.getByRole("button", { name: "登録して審査を申請する" }).click();

    await expect(page).toHaveURL(/\/onboarding\/pending$/);
    await expect(
      page.getByRole("heading", { name: "審査中です" }),
    ).toBeVisible();
  });
});

test.describe("否認された団体の再申請", () => {
  test.use({ storageState: "playwright/.auth/organization-reapply.json" });

  test("O-E2: 否認理由を確認して申請内容を修正できる", async ({ page }) => {
    await page.goto("/onboarding/pending");

    await expect(
      page.getByRole("heading", { name: "申請は否認されました" }),
    ).toBeVisible();
    await expect(page.getByText("否認理由", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E 再申請前の否認理由")).toBeVisible();

    await page.getByRole("link", { name: "申請内容を修正する" }).click();
    await expect(page).toHaveURL(/\/onboarding\/organization$/);
    await expect(
      page.getByRole("heading", { name: "申請内容の修正" }),
    ).toBeVisible();

    await page.getByLabel("団体名").fill("E2E再申請団体 更新済み");
    await page
      .getByRole("button", { name: "内容を更新して再申請する" })
      .click();

    await expect(page).toHaveURL(/\/onboarding\/pending$/);
    await expect(
      page.getByRole("heading", { name: "審査中です" }),
    ).toBeVisible();
    await expect(page.getByText("E2E再申請団体 更新済み")).toBeVisible();
  });
});

test.describe("承認済み団体プロフィールの再審査", () => {
  test.use({
    storageState: "playwright/.auth/organization-profile-review.json",
  });

  test("O-E3: プロフィール更新後は再審査完了までアクセスが制限される", async ({
    page,
  }) => {
    await page.goto("/dashboard/profile/edit");

    await expect(
      page.getByRole("heading", { name: "団体プロフィールの編集" }),
    ).toBeVisible();
    await page.getByLabel("団体名").fill("E2Eプロフィール再審査団体 更新済み");
    await page
      .getByRole("button", { name: "内容を更新して再申請する" })
      .click();

    await expect(page).toHaveURL(/\/onboarding\/pending$/);
    await expect(
      page.getByRole("heading", { name: "審査中です" }),
    ).toBeVisible();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding\/pending$/);
    await expect(
      page.getByRole("heading", { name: "審査中です" }),
    ).toBeVisible();
  });
});

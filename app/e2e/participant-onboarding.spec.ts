import { expect, test, type Page } from "@playwright/test";

async function expectRequiredErrorPosition(
  page: Page,
  fieldId: string,
  errorId: string,
  message: string
) {
  const field = page.locator(`#${fieldId}`);
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAttribute("aria-describedby", errorId);
  await expect(page.locator(`#${errorId}`)).toHaveText(message);

  const position = await field.evaluate((element) => {
    const header = document.querySelector("header")?.getBoundingClientRect();
    return {
      inputTop: element.getBoundingClientRect().top,
      headerBottom: header?.bottom ?? 0,
    };
  });

  expect(position.inputTop).toBeGreaterThanOrEqual(position.headerBottom + 16);
}

test.describe("参加者オンボーディング", () => {
  test.use({ storageState: "playwright/.auth/participant-fresh.json" });

  test("P-2: 参加者ロールを選びプロフィールを登録できる", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding\/role$/);
    await expect(
      page.getByRole("heading", { name: "利用方法を選択" })
    ).toBeVisible();

    await page
      .getByRole("button", { name: /ボランティアに参加する/ })
      .click();
    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page).toHaveURL(/\/onboarding\/participant$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding\/role$/);

    await page
      .getByRole("button", { name: /ボランティアに参加する/ })
      .click();
    await page.getByRole("button", { name: "次へ" }).click();
    await expect(page).toHaveURL(/\/onboarding\/participant$/);

    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });

      await page.getByLabel("表示名").fill("");
      await page.getByRole("button", { name: "登録して診断へ進む" }).click();
      await expectRequiredErrorPosition(
        page,
        "participant-name",
        "participant-name-error",
        "表示名を入力してください"
      );
      await expect(page).toHaveURL(/\/onboarding\/participant$/);

      await page.getByLabel("表示名").fill("検証参加者");
      await page.getByLabel("年").selectOption("");
      await page.getByRole("button", { name: "登録して診断へ進む" }).click();
      await expectRequiredErrorPosition(
        page,
        "participant-birth-year",
        "participant-birth-year-error",
        "生年を選択してください"
      );

      await page.getByLabel("年").selectOption("2000");
      await page.getByLabel("月").selectOption("");
      await page.getByRole("button", { name: "登録して診断へ進む" }).click();
      await expectRequiredErrorPosition(
        page,
        "participant-birth-month",
        "participant-birth-month-error",
        "生月を選択してください"
      );

      await page.getByLabel("月").selectOption("1");
      await page.getByLabel("日").selectOption("");
      await page.getByRole("button", { name: "登録して診断へ進む" }).click();
      await expectRequiredErrorPosition(
        page,
        "participant-birth-day",
        "participant-birth-day-error",
        "生日を選択してください"
      );

      await page.getByLabel("日").selectOption("1");
      await page.getByLabel("都道府県").selectOption("");
      await page.getByRole("button", { name: "登録して診断へ進む" }).click();
      await expectRequiredErrorPosition(
        page,
        "participant-region",
        "participant-region-error",
        "都道府県を選択してください"
      );

      await page.getByLabel("都道府県").selectOption("東京都");
    }

    await page.getByLabel("表示名").fill("E2E 新規参加者");
    await page.getByLabel("年").selectOption("1998");
    await page.getByLabel("月").selectOption("4");
    await page.getByLabel("日").selectOption("1");
    await page.getByLabel("都道府県").selectOption("東京都");
    await expect(
      page.getByText(
        "LINE IDは、応募した団体とのマッチングが成立した場合にのみ、その団体へ共有されます。マッチング成立前や他の団体には公開されません。"
      )
    ).toBeVisible();
    await page.getByLabel("LINE ID（任意）").fill("e2e-fresh-line");
    await page.getByRole("button", { name: "登録して診断へ進む" }).click();

    await expect(page).toHaveURL(/\/diagnosis$/);
    await expect(
      page.getByRole("heading", { name: "性格傾向チェック" })
    ).toBeVisible();
  });
});

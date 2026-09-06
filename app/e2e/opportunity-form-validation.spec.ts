import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

test.use({ storageState: "playwright/.auth/organization.json" });

const VIEWPORTS = [
  { name: "スマートフォン320", width: 320, height: 740 },
  { name: "スマートフォン390", width: 390, height: 844 },
  { name: "PC", width: 1512, height: 772 },
] as const;

type ValidationField =
  | "title"
  | "description"
  | "publishedAt"
  | "applicationDeadline"
  | "capacity"
  | "minAge";

function validationField(page: Page, field: ValidationField): Locator {
  return page.locator(`[data-validation-field="${field}"]`);
}

async function expectValidationFieldInViewport(
  page: Page,
  field: ValidationField
) {
  const wrapper = validationField(page, field);
  const metrics = await wrapper.evaluate((element) => {
    const header = document.querySelector("header");
    const label = element.querySelector("label");
    const input = element.querySelector("input, textarea, select");
    const error = element.querySelector('[role="alert"]');
    if (!header || !label || !input || !error) {
      throw new Error("検証対象のラベル・入力・エラーが見つかりません");
    }

    const headerRect = header.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const inputRect = input.getBoundingClientRect();
    const errorRect = error.getBoundingClientRect();

    return {
      headerBottom: headerRect.bottom,
      labelTop: labelRect.top,
      inputTop: inputRect.top,
      inputBottom: inputRect.bottom,
      errorTop: errorRect.top,
      errorBottom: errorRect.bottom,
      viewportHeight: window.innerHeight,
      activeName: document.activeElement?.getAttribute("name"),
      inputName: input.getAttribute("name"),
      describedBy: input.getAttribute("aria-describedby"),
      errorId: error.id,
    };
  });

  expect(metrics.activeName).toBe(metrics.inputName);
  expect(metrics.labelTop).toBeGreaterThanOrEqual(metrics.headerBottom + 8);
  expect(metrics.inputTop).toBeGreaterThanOrEqual(metrics.headerBottom + 8);
  expect(metrics.errorTop).toBeGreaterThanOrEqual(metrics.headerBottom + 8);
  expect(metrics.inputBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.errorBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.describedBy).toContain(metrics.errorId);
}

async function saveScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: false,
  });
}

test.describe("募集案件フォームのネイティブ検証エラー", () => {
  test("新規作成で複数エラーをDOM順に表示し、修正後は説明へ移動する", async ({
    page,
  }, testInfo) => {
    for (const viewport of VIEWPORTS) {
      await test.step(`${viewport.name}で新規作成`, async () => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto("/dashboard/opportunities/new");

        const title = page.getByLabel("案件タイトル");
        const submit = page.getByRole("button", { name: "作成する" });
        await submit.click();
        await expect(
          page.getByText("案件タイトルを入力してください", { exact: true })
        ).toBeVisible();
        await expect(
          page.getByText("案件説明を入力してください", { exact: true })
        ).toBeVisible();
        await expectValidationFieldInViewport(page, "title");
        await expect(title).toHaveAttribute("aria-invalid", "true");
        await expect(page).toHaveURL(/\/dashboard\/opportunities\/new/);
        await saveScreenshot(page, testInfo, `new-${viewport.width}-title`);

        await title.fill("入力済みの案件タイトル");
        await submit.click();
        await expect(
          page.getByText("案件説明を入力してください", { exact: true })
        ).toBeVisible();
        await expect(
          page.getByText("案件タイトルを入力してください", { exact: true })
        ).toHaveCount(0);
        await expect(title).toHaveValue("入力済みの案件タイトル");
        await expectValidationFieldInViewport(page, "description");
        await saveScreenshot(page, testInfo, `new-${viewport.width}-description`);
      });
    }
  });

  test("編集でタイトルと説明を空にしても保存せず順番に修正できる", async ({
    page,
  }, testInfo) => {
    await page.goto("/dashboard");
    const opportunityLink = page.getByRole("link", {
      name: /^E2E 団体フロー案件$/,
    });
    await expect(opportunityLink).toBeVisible();
    const opportunityHref = await opportunityLink.getAttribute("href");
    if (!opportunityHref) throw new Error("編集対象案件のURLがありません");

    for (const viewport of VIEWPORTS) {
      await test.step(`${viewport.name}で編集`, async () => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto(`${opportunityHref}/edit`);

        const title = page.getByLabel("案件タイトル");
        const description = page.getByLabel("案件説明");
        const save = page.getByRole("button", { name: "保存する" });
        await title.fill("");
        await description.fill("");
        await save.click();

        await expect(
          page.getByText("案件タイトルを入力してください", { exact: true })
        ).toBeVisible();
        await expectValidationFieldInViewport(page, "title");
        await expect(page).toHaveURL(/\/edit$/);
        await saveScreenshot(page, testInfo, `edit-${viewport.width}-title`);

        await title.fill("編集確認用タイトル");
        await save.click();
        await expect(
          page.getByText("案件説明を入力してください", { exact: true })
        ).toBeVisible();
        await expect(title).toHaveValue("編集確認用タイトル");
        await expectValidationFieldInViewport(page, "description");
        await saveScreenshot(page, testInfo, `edit-${viewport.width}-description`);
      });
    }
  });

  test("複製フォームでも必須エラーをヘッダー下に表示する", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    const copyLink = page.getByRole("link", { name: "複製" }).first();
    await expect(copyLink).toBeVisible();
    const copyHref = await copyLink.getAttribute("href");
    if (!copyHref) throw new Error("複製対象案件のURLがありません");

    await page.goto(copyHref);
    await expect(page.getByRole("heading", { name: "新しい募集案件を作成" })).toBeVisible();
    await page.getByLabel("案件タイトル").fill("");
    await page.getByLabel("案件説明").fill("");
    await page.getByRole("button", { name: "作成する" }).click();

    await expect(
      page.getByText("案件タイトルを入力してください", { exact: true })
    ).toBeVisible();
    await expectValidationFieldInViewport(page, "title");
    await expect(page).toHaveURL(/\/dashboard\/opportunities\/new\?copyFrom=/);
    await saveScreenshot(page, testInfo, "copy-title");
  });

  test("公開予約日時の必須エラーを対象欄へ表示する", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/opportunities/new");
    await page.getByLabel("案件タイトル").fill("予約案件");
    await page.getByLabel("案件説明").fill("予約案件の説明です。");
    await page.getByRole("radio", { name: "公開予約" }).check();
    await page.getByRole("button", { name: "作成する" }).click();

    await expect(
      page.getByText("公開予約日時を入力してください", { exact: true })
    ).toBeVisible();
    await expectValidationFieldInViewport(page, "publishedAt");
    await expect(page).toHaveURL(/\/dashboard\/opportunities\/new$/);
    await saveScreenshot(page, testInfo, "scheduled-published-at");
  });

  test("応募締切の途中入力を表示し、修正するとエラーが消える", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/opportunities/new");
    await page.getByLabel("案件タイトル").fill("締切確認案件");
    await page.getByLabel("案件説明").fill("締切確認の説明です。");
    const deadline = page.getByLabel("応募締切（任意）");
    await deadline.focus();
    await deadline.press("ArrowUp");
    expect(await deadline.evaluate((input: HTMLInputElement) => input.validity.badInput)).toBe(true);
    await page.getByRole("button", { name: "作成する" }).click();
    await expect(validationField(page, "applicationDeadline").getByRole("alert")).toHaveText(/\S+/);
    await expectValidationFieldInViewport(page, "applicationDeadline");
    await expect(page).toHaveURL(/\/dashboard\/opportunities\/new$/);
    await deadline.fill("2099-01-01");
    await expect(validationField(page, "applicationDeadline").getByRole("alert")).toHaveCount(0);
    await expect(deadline).toHaveAttribute("aria-invalid", "false");
  });

  test("定員の範囲外エラーもインライン表示して送信しない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/opportunities/new");
    await page.getByLabel("案件タイトル").fill("定員エラー案件");
    await page.getByLabel("案件説明").fill("定員エラーの説明です。");
    await page.getByLabel("定員（任意）").fill("0");
    await page.getByRole("button", { name: "作成する" }).click();

    const capacityError = validationField(page, "capacity").getByRole("alert");
    await expect(capacityError).toHaveText(/\S+/);
    await expectValidationFieldInViewport(page, "capacity");
    await expect(page).toHaveURL(/\/dashboard\/opportunities\/new$/);

    await page.getByLabel("定員（任意）").fill("1");
    await page
      .getByLabel("対象年齢の下限（法令・安全上必要な場合のみ）")
      .fill("121");
    await page.getByRole("button", { name: "作成する" }).click();

    const ageError = validationField(page, "minAge").getByRole("alert");
    await expect(ageError).toHaveText(/\S+/);
    await expectValidationFieldInViewport(page, "minAge");
    await expect(page).toHaveURL(/\/dashboard\/opportunities\/new$/);
  });
});

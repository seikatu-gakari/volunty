import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ storageState: "playwright/.auth/organization-secondary.json" });

const APPROACH_PARTICIPANT_NAME = "E2E 団体操作専用参加者";
const LONG_OPPORTUNITY_TITLE =
  "E2Eテンプレートレイアウト確認用非常に長い募集案件タイトル空白なしテストデータ";
const LONG_JAPANESE_TEMPLATE_NAME =
  "初回案内用長い日本語テンプレート名前スマートフォン幅確認用データ枠内収まり確認長文サンプルボランティア参加案内メッセージ保存テスト";
const LONG_ASCII_TEMPLATE_NAME =
  "LongTemplateNameWithoutWhitespaceForNarrowViewportLayoutVerificationAndPersistence";
const FIRST_TEMPLATE_BODY =
  "{participantName}さん、{opportunityTitle}への参加をご検討ください。";
const SECOND_TEMPLATE_BODY =
  "{opportunityTitle}についてご案内します。{participantName}さんにおすすめです。";

type Bounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

async function openApproachForm(page: Page) {
  await page.goto("/dashboard/participants");
  await page
    .getByRole("link", {
      name: new RegExp(
        `${APPROACH_PARTICIPANT_NAME}.*詳細を確認してアプローチ`,
      ),
    })
    .click();
  await page.getByRole("link", { name: "アプローチする" }).click();
  await expect(page.getByRole("heading", { name: "送信内容" })).toBeVisible();
}

async function getInnerBounds(locator: Locator): Promise<Bounds> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const number = (value: string) => Number.parseFloat(value) || 0;

    return {
      bottom:
        rect.bottom - number(style.borderBottomWidth) - number(style.paddingBottom),
      left: rect.left + number(style.borderLeftWidth) + number(style.paddingLeft),
      right:
        rect.right - number(style.borderRightWidth) - number(style.paddingRight),
      top: rect.top + number(style.borderTopWidth) + number(style.paddingTop),
    };
  });
}

async function expectWithinParent(
  parent: Locator,
  child: Locator,
  description: string,
) {
  await child.scrollIntoViewIfNeeded();
  const parentBounds = await getInnerBounds(parent);
  const childBox = await child.boundingBox();
  expect(childBox, `${description} の矩形が取得できること`).not.toBeNull();
  if (!childBox) return;

  expect(childBox.x, `${description} の左端`).toBeGreaterThanOrEqual(
    parentBounds.left - 1,
  );
  expect(
    childBox.x + childBox.width,
    `${description} の右端`,
  ).toBeLessThanOrEqual(parentBounds.right + 1);
  expect(childBox.y, `${description} の上端`).toBeGreaterThanOrEqual(
    parentBounds.top - 1,
  );
  expect(
    childBox.y + childBox.height,
    `${description} の下端`,
  ).toBeLessThanOrEqual(parentBounds.bottom + 1);
}

async function saveTemplate(
  page: Page,
  templateName: string,
  templateBody: string,
  options: { assertPending?: boolean } = {},
) {
  const nameInput = page.getByLabel("保存名");
  const messageInput = page.getByLabel("アプローチ文");
  const saveButton = page.getByRole("button", { name: "保存", exact: true });

  await nameInput.fill(templateName);
  await messageInput.fill(templateBody);
  await expect(saveButton).toBeEnabled();

  if (!options.assertPending) {
    await saveButton.click();
    await expect(
      page.getByText("テンプレートを保存しました", { exact: true }),
    ).toBeVisible();
    return;
  }

  let releaseResponse: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.headers()["next-action"]) {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    await responseGate;
    await route.fulfill({ response });
  });

  try {
    const actionRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" && Boolean(request.headers()["next-action"]),
    );
    await saveButton.click();
    await actionRequest;
    await expect(saveButton).toBeDisabled();
  } finally {
    releaseResponse?.();
    await expect(
      page.getByText("テンプレートを保存しました", { exact: true }),
    ).toBeVisible();
    await page.unroute("**/*");
  }
}

async function expectSaveButtonGeometry(
  page: Page,
) {
  const saveButton = page.getByRole("button", { name: "保存", exact: true });
  const saveText = saveButton.getByText("保存", { exact: true });
  const buttonBox = await saveButton.boundingBox();
  const textBox = await saveText.boundingBox();
  const iconBox = await saveButton.locator("svg").boundingBox();

  expect(buttonBox).not.toBeNull();
  expect(textBox).not.toBeNull();
  expect(iconBox).not.toBeNull();
  if (!buttonBox || !textBox || !iconBox) return;

  expect(buttonBox.height, "保存ボタンの高さ").toBeGreaterThanOrEqual(44);
  const textLineCount = await saveText.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getClientRects().length;
  });
  expect(textLineCount, "保存の文字が1行であること").toBe(1);
  expect(iconBox.x, "保存アイコンの左端").toBeGreaterThanOrEqual(
    buttonBox.x - 1,
  );
  expect(iconBox.x + iconBox.width, "保存アイコンの右端").toBeLessThanOrEqual(
    buttonBox.x + buttonBox.width + 1,
  );
  expect(iconBox.y, "保存アイコンの上端").toBeGreaterThanOrEqual(
    buttonBox.y - 1,
  );
  expect(
    iconBox.y + iconBox.height,
    "保存アイコンの下端",
  ).toBeLessThanOrEqual(buttonBox.y + buttonBox.height + 1);
  expect(iconBox.x + iconBox.width, "保存アイコンと文字の重なり").toBeLessThanOrEqual(
    textBox.x + 1,
  );
}

test("テンプレート欄が狭い幅でも枠内に収まり保存できる", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openApproachForm(page);

  const templateSelect = page.getByLabel("テンプレート");
  const templateNameInput = page.getByLabel("保存名");
  const messageInput = page.getByLabel("アプローチ文");
  const opportunitySelect = page.getByLabel("関連する募集案件");
  const saveButton = page.getByRole("button", { name: "保存", exact: true });
  const templatePanel = templateSelect.locator("xpath=../..");
  const saveRow = templateNameInput.locator("xpath=..");
  const opportunityField = opportunitySelect.locator("xpath=..");

  await expect(templateSelect).toHaveCount(1);
  await expect(templateNameInput).toHaveCount(1);
  await expect(saveButton).toHaveCount(1);
  await expect(templateSelect.locator("option")).toHaveCount(1);
  await expect(saveButton).toBeDisabled();

  await opportunitySelect.selectOption({ label: LONG_OPPORTUNITY_TITLE });
  await expectWithinParent(
    opportunityField,
    opportunitySelect,
    "長い案件タイトルのselect",
  );
  await expectWithinParent(templatePanel, templateSelect, "テンプレートselect");
  await expectWithinParent(templatePanel, templateNameInput, "保存名input");
  await expectWithinParent(saveRow, templateNameInput, "保存名inputの直接の親");
  await expectWithinParent(saveRow, saveButton, "保存buttonの直接の親");

  await saveTemplate(page, LONG_JAPANESE_TEMPLATE_NAME, FIRST_TEMPLATE_BODY, {
    assertPending: true,
  });
  await expectWithinParent(
    templatePanel,
    page.getByText("テンプレートを保存しました", { exact: true }),
    "保存結果メッセージ",
  );
  await expectSaveButtonGeometry(page);

  await page.reload();
  await expect(templateSelect.locator("option")).toHaveCount(2);
  await templateSelect.selectOption({ label: LONG_JAPANESE_TEMPLATE_NAME });
  await expect(templateNameInput).toHaveValue(LONG_JAPANESE_TEMPLATE_NAME);
  await expect(messageInput).toHaveValue(
    FIRST_TEMPLATE_BODY.replace("{participantName}", APPROACH_PARTICIPANT_NAME)
      .replace("{opportunityTitle}", LONG_OPPORTUNITY_TITLE),
  );

  await saveTemplate(page, LONG_ASCII_TEMPLATE_NAME, SECOND_TEMPLATE_BODY);
  await page.reload();
  await expect(templateSelect.locator("option")).toHaveCount(3);
  await templateSelect.selectOption({ label: LONG_ASCII_TEMPLATE_NAME });
  await expect(templateNameInput).toHaveValue(LONG_ASCII_TEMPLATE_NAME);
  await expect(messageInput).toHaveValue(
    SECOND_TEMPLATE_BODY.replace("{participantName}", APPROACH_PARTICIPANT_NAME)
      .replace("{opportunityTitle}", LONG_OPPORTUNITY_TITLE),
  );

  for (const width of [320, 360, 390, 640, 768, 1280]) {
    await page.setViewportSize({ width, height: width === 320 ? 740 : 844 });
    await page.reload();

    await expect(templateSelect).toHaveCount(1);
    await expect(templateNameInput).toHaveCount(1);
    await expect(saveButton).toHaveCount(1);
    await opportunitySelect.selectOption({ label: LONG_OPPORTUNITY_TITLE });
    await templateSelect.selectOption({ label: LONG_ASCII_TEMPLATE_NAME });
    await expect(templateNameInput).toHaveValue(LONG_ASCII_TEMPLATE_NAME);
    await expectWithinParent(templatePanel, templateSelect, `${width}pxのテンプレートselect`);
    await expectWithinParent(templatePanel, templateNameInput, `${width}pxの保存名input`);
    await expectWithinParent(saveRow, templateNameInput, `${width}pxの保存名inputの直接の親`);
    await expectWithinParent(saveRow, saveButton, `${width}pxの保存buttonの直接の親`);
    await expectWithinParent(opportunityField, opportunitySelect, `${width}pxの案件select`);
    await expectSaveButtonGeometry(page);

    const flexDirection = await saveRow.evaluate(
      (element) => window.getComputedStyle(element).flexDirection,
    );
    expect(flexDirection, `${width}pxの保存行の方向`).toBe(
      width < 640 ? "column" : "row",
    );
    expect(
      await page.evaluate(() => document.body.scrollWidth),
      `${width}pxのbody横幅`,
    ).toBeLessThanOrEqual(width);
  }
});

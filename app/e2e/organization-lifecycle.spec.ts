import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ storageState: "playwright/.auth/organization-lifecycle.json" });

const TITLES = {
  approachSend: "E2E 団体アプローチ送信案件",
  applicantDecline: "E2E 団体応募辞退案件",
  historyAccepted: "E2E 団体履歴承認案件",
  historyDeclined: "E2E 団体履歴辞退案件",
  historyComplete: "E2E 団体活動完了案件",
  certificateApprove: "E2E 団体証明書承認案件",
  certificateReject: "E2E 団体証明書却下案件",
} as const;

const APPROACH_PARTICIPANT_NAME = "E2E 参加者(診断済)";

async function scoreFromParticipantCard(card: Locator): Promise<number> {
  const text = await card.getByText(/^\d+%$/).textContent();
  const match = text?.match(/^(\d+)%$/);
  expect(
    match,
    "参加者カードに数値の相性スコアが表示されること",
  ).not.toBeNull();
  return Number(match?.[1]);
}

function approachStatusCard(page: Page, title: string) {
  return page
    .getByText(title, { exact: true })
    .locator("xpath=ancestor::div[descendant::h2 and descendant::span][1]");
}

function matchingHistoryCard(page: Page, title: string) {
  return page
    .getByText(title, { exact: true })
    .locator(
      "xpath=ancestor::div[descendant::a[normalize-space()='応募詳細を見る']][1]",
    );
}

test.describe("団体業務ライフサイクル", () => {
  test("O-E4: 案件の詳細を設定して作成・編集・募集終了できる", async ({
    page,
  }) => {
    const title = `E2E 団体案件管理 ${Date.now()}`;

    await page.goto("/dashboard/opportunities/new");
    await page.getByLabel("案件タイトル").fill(title);
    await page.getByLabel("案件説明").fill("作成時の案件説明です。");
    await page.getByLabel("活動場所（任意）").fill("渋谷区");
    await page.getByLabel("開始日（任意）").fill("2026-08-01");
    await page.getByLabel("終了日（任意）").fill("2026-08-31");
    await page.getByLabel("定員（任意）").fill("12");
    await page.getByLabel("カテゴリ（任意）").selectOption("環境保全");
    await page.getByLabel("参加形態（任意）").selectOption("hybrid");
    await page.getByLabel("外向性", { exact: true }).check();
    await page.getByLabel("外向性のスコア").fill("80");
    await page.getByRole("button", { name: "作成する" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(/\/dashboard\/opportunities\/[^/]+$/);
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await page.getByRole("link", { name: "編集", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/opportunities\/[^/]+\/edit$/);
    await expect(
      page.getByRole("heading", { name: "募集案件を編集" }),
    ).toBeVisible();

    await page.getByLabel("案件説明").fill("編集後の案件説明です。");
    await page.getByRole("radio", { name: "募集終了" }).check();
    await page.getByRole("button", { name: "保存する" }).click();

    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("編集後の案件説明です。")).toBeVisible();
    await expect(page.getByText("募集終了", { exact: true })).toBeVisible();
  });

  test("O-E5: おすすめ参加者を相性スコア順に確認できる", async ({ page }) => {
    await page.goto("/dashboard/participants");
    await expect(
      page.getByRole("heading", { name: "おすすめ参加者" }),
    ).toBeVisible();

    const participantCards = await page
      .getByRole("link")
      .filter({ hasText: "詳細を確認してアプローチ" })
      .all();
    expect(participantCards.length).toBeGreaterThanOrEqual(2);

    const [firstParticipant, secondParticipant] = participantCards;
    const firstScore = await scoreFromParticipantCard(firstParticipant);
    const secondScore = await scoreFromParticipantCard(secondParticipant);
    const opportunityTitle = await firstParticipant
      .getByText(/^E2E 団体.+案件(?: \d+)?$/)
      .textContent();
    expect(
      opportunityTitle,
      "先頭参加者の対象案件名が表示されること",
    ).not.toBeNull();

    expect(firstScore).toBeGreaterThanOrEqual(secondScore);
    await firstParticipant.click();

    await expect(page.getByRole("heading", { name: "相性概要" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "プロフィール" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "BIG5 スコア" }),
    ).toBeVisible();
    await expect(
      page.getByText(opportunityTitle ?? "", { exact: true }),
    ).toBeVisible();
  });

  test("O-E6: おすすめ参加者へアプローチし重複送信を防止できる", async ({
    page,
  }) => {
    await page.goto("/dashboard/participants");
    await page
      .getByRole("link", {
        name: new RegExp(
          `${APPROACH_PARTICIPANT_NAME.replace(/[()]/g, "\\$&")}.*詳細を確認してアプローチ`,
        ),
      })
      .click();
    await page.getByRole("link", { name: "アプローチする" }).click();
    await expect(page).toHaveURL(/\/dashboard\/approaches\/new\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "送信内容" })).toBeVisible();
    const approachUrl = page.url();

    await page
      .getByLabel("関連する募集案件")
      .selectOption({ label: TITLES.approachSend });
    await page
      .getByLabel("アプローチ文")
      .fill("E2E 団体からのアプローチメッセージ");
    await page.getByRole("button", { name: "アプローチを送信" }).click();

    await expect(page.getByText("アプローチを送信しました。")).toBeVisible();
    await page.getByRole("link", { name: "送信履歴を見る" }).click();
    const sentApproach = approachStatusCard(page, TITLES.approachSend);
    await expect(
      sentApproach.getByRole("heading", {
        name: APPROACH_PARTICIPANT_NAME,
      }),
    ).toBeVisible();
    await expect(
      sentApproach.getByText(TITLES.approachSend, {
        exact: true,
      }),
    ).toBeVisible();

    await page.goto(approachUrl);
    const sentOption = page.getByRole("option", {
      name: `${TITLES.approachSend}（送信済み）`,
    });
    await expect(sentOption).toBeDisabled();
  });

  test("O-E7: アプローチ履歴に全回答状態を表示する", async ({ page }) => {
    await page.goto("/dashboard/approaches");
    await expect(
      page.getByRole("heading", { name: "アプローチ送信履歴" }),
    ).toBeVisible();

    for (const [title, status] of [
      ["E2E 団体アプローチ未回答案件", "未回答"],
      ["E2E 団体アプローチ承諾済み案件", "承諾済み"],
      ["E2E 団体アプローチ辞退済み案件", "辞退済み"],
      ["E2E 団体アプローチ期限切れ案件", "期限切れ"],
    ] as const) {
      await expect(
        approachStatusCard(page, title).getByText(status, { exact: true }),
      ).toBeVisible();
    }
  });

  test("O-E8: 応募者の診断情報を確認して辞退できる", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("link", { name: new RegExp(TITLES.applicantDecline) })
      .click();
    await page.getByRole("link", { name: "詳細を見る" }).click();

    await expect(
      page.getByRole("heading", { name: "応募メッセージ" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${TITLES.applicantDecline}へのE2E応募メッセージです。`),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "診断タイプ" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "BIG5 スコア詳細" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "辞退する" }).click();
    await expect(page.getByText("辞退済み", { exact: true })).toBeVisible();
  });

  test("O-E9: 応募を活動完了にして状態別履歴を確認できる", async ({ page }) => {
    await page.goto("/dashboard");
    await page
      .getByRole("link", { name: new RegExp(TITLES.historyComplete) })
      .click();
    await page.getByRole("button", { name: "活動完了にする" }).click();
    await expect(page.getByText("活動完了", { exact: true })).toBeVisible();

    await page.goto("/dashboard/history");
    await expect(
      page.getByRole("heading", { name: "マッチング履歴" }),
    ).toBeVisible();
    for (const [title, status] of [
      [TITLES.historyAccepted, "承認済み"],
      [TITLES.historyDeclined, "辞退済み"],
      [TITLES.historyComplete, "活動完了"],
    ] as const) {
      await expect(
        matchingHistoryCard(page, title).getByText(status, { exact: true }),
      ).toBeVisible();
    }
  });

  test("O-E10: 証明書申請を承認し別申請を理由付きで却下できる", async ({
    page,
  }) => {
    await page.goto("/dashboard/certificates");
    await page
      .getByRole("link", { name: new RegExp(TITLES.certificateApprove) })
      .click();
    await page.getByRole("button", { name: "承認して発行する" }).click();
    await expect(page.getByText("発行済み", { exact: true })).toBeVisible();
    await expect(page.getByText("証明書番号", { exact: true })).toBeVisible();

    await page.goto("/dashboard/certificates");
    await page
      .getByRole("link", { name: new RegExp(TITLES.certificateReject) })
      .click();
    await page.getByLabel("却下理由").fill("E2E 証明書却下理由");
    await page.getByRole("button", { name: "却下する" }).click();
    await expect(page.getByText("却下", { exact: true })).toBeVisible();
    await expect(page.getByText("却下理由: E2E 証明書却下理由")).toBeVisible();
  });
});

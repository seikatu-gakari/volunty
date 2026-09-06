import { expect, test, type Browser, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const AUTH_STATE = {
  participant: "playwright/.auth/participant.json",
  organization: "playwright/.auth/organization-lifecycle.json",
} as const;

const PUBLICATION_NULL_TITLE = "E2E 公開状態 公開日時NULL案件";
const PUBLICATION_SCHEDULED_TITLE = "E2E 公開状態 予約案件";
const PUBLICATION_CLOSED_TITLE = "E2E 公開状態 募集終了案件";

type OpportunityStatus = "draft" | "published" | "closed";

type OpportunityState = {
  id: string;
  status: OpportunityStatus;
  publishedAt: Date | null;
};

const STATUS_LABEL: Record<OpportunityStatus, string> = {
  draft: "下書き",
  published: "募集中",
  closed: "募集終了",
};

async function readOpportunityState(title: string): Promise<OpportunityState> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{
      id: string;
      status: OpportunityStatus;
      published_at: Date | null;
    }>(
      `SELECT id::text, status::text, published_at
       FROM public.m_opportunity
       WHERE title = $1`,
      [title],
    );
    const row = rows[0];
    if (!row) throw new Error(`E2E案件が見つかりません: ${title}`);
    return {
      id: row.id,
      status: row.status,
      publishedAt: row.published_at,
    };
  } finally {
    await client.end();
  }
}

async function openAuthenticatedPages(browser: Browser) {
  const organizationContext = await browser.newContext({
    storageState: AUTH_STATE.organization,
  });
  const participantContext = await browser.newContext({
    storageState: AUTH_STATE.participant,
  });
  return {
    organizationContext,
    organizationPage: await organizationContext.newPage(),
    participantContext,
    participantPage: await participantContext.newPage(),
  };
}

async function expectHiddenFromParticipant(
  page: Page,
  state: OpportunityState,
  title: string,
) {
  await page.goto(`/opportunities?q=${encodeURIComponent(title)}`);
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  const response = await page.goto(`/opportunities/${state.id}`);
  expect(response?.status()).toBe(404);
}

async function expectVisibleToParticipant(
  page: Page,
  state: OpportunityState,
  title: string,
) {
  await page.goto(`/opportunities?q=${encodeURIComponent(title)}`);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.goto(`/opportunities/${state.id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

async function saveOrganizationStatus(
  page: Page,
  state: OpportunityState,
  status: "draft" | "published" | "closed",
  description: string,
) {
  await page.goto(`/dashboard/opportunities/${state.id}/edit`);
  await page.getByLabel("案件説明").fill(description);
  await page.getByRole("radio", { name: STATUS_LABEL[status] }).check();
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page).toHaveURL(`/dashboard/opportunities/${state.id}`);
}

test.describe.serial("案件公開状態", () => {
  test("下書き作成から公開・内容編集・下書き化・再公開まで参加者の可視性が一致する", async ({
    browser,
  }) => {
    const {
      organizationContext,
      organizationPage,
      participantContext,
      participantPage,
    } = await openAuthenticatedPages(browser);

    try {
      const title = `E2E 公開状態 動的案件 ${Date.now()}`;
      await organizationPage.goto("/dashboard/opportunities/new");
      await organizationPage.getByLabel("案件タイトル").fill(title);
      await organizationPage.getByLabel("案件説明").fill("下書き時の説明です。");
      await organizationPage.getByRole("radio", { name: "下書き保存" }).check();
      await organizationPage.getByRole("button", { name: "作成する" }).click();
      await expect(organizationPage).toHaveURL(/\/dashboard$/);

      const opportunityLink = organizationPage.getByRole("link", {
        name: title,
        exact: true,
      });
      await expect(opportunityLink).toBeVisible();
      const href = await opportunityLink.getAttribute("href");
      const id = href?.match(/^\/dashboard\/opportunities\/([^/]+)$/)?.[1];
      expect(id).toBeTruthy();
      const draftState: OpportunityState = {
        id: id!,
        status: "draft",
        publishedAt: null,
      };

      await organizationPage.goto(`/dashboard/opportunities/${draftState.id}`);
      await expect(organizationPage.getByText("下書き", { exact: true })).toBeVisible();
      await expectHiddenFromParticipant(participantPage, draftState, title);

      await saveOrganizationStatus(
        organizationPage,
        draftState,
        "published",
        "公開直後の説明です。",
      );
      let publishedState = await readOpportunityState(title);
      expect(publishedState.status).toBe("published");
      expect(publishedState.publishedAt).not.toBeNull();
      expect(publishedState.publishedAt!.getTime()).toBeLessThanOrEqual(Date.now());
      await expectVisibleToParticipant(participantPage, publishedState, title);

      const firstPublishedAt = publishedState.publishedAt!.getTime();
      await saveOrganizationStatus(
        organizationPage,
        publishedState,
        "published",
        "内容だけを編集した説明です。",
      );
      publishedState = await readOpportunityState(title);
      expect(publishedState.publishedAt?.getTime()).toBe(firstPublishedAt);
      await expectVisibleToParticipant(participantPage, publishedState, title);
      await expect(participantPage.getByText("内容だけを編集した説明です。", { exact: true })).toBeVisible();

      await saveOrganizationStatus(
        organizationPage,
        publishedState,
        "draft",
        "再公開前の下書き説明です。",
      );
      const redraftState = await readOpportunityState(title);
      expect(redraftState).toMatchObject({ status: "draft", publishedAt: null });
      await expectHiddenFromParticipant(participantPage, redraftState, title);

      await saveOrganizationStatus(
        organizationPage,
        redraftState,
        "published",
        "再公開後の説明です。",
      );
      const republishedState = await readOpportunityState(title);
      expect(republishedState.status).toBe("published");
      expect(republishedState.publishedAt?.getTime()).toBeGreaterThan(firstPublishedAt);
      await expectVisibleToParticipant(participantPage, republishedState, title);
    } finally {
      await organizationContext.close();
      await participantContext.close();
    }
  });

  test("日時NULL・予約・募集終了の既存状態を参加者に公開せず、明示操作後だけ公開する", async ({
    browser,
  }) => {
    const {
      organizationContext,
      organizationPage,
      participantContext,
      participantPage,
    } = await openAuthenticatedPages(browser);

    try {
      const nullState = await readOpportunityState(PUBLICATION_NULL_TITLE);
      await expectHiddenFromParticipant(participantPage, nullState, PUBLICATION_NULL_TITLE);
      await saveOrganizationStatus(
        organizationPage,
        nullState,
        "published",
        "公開日時を補完した説明です。",
      );
      const repairedNullState = await readOpportunityState(PUBLICATION_NULL_TITLE);
      expect(repairedNullState.status).toBe("published");
      expect(repairedNullState.publishedAt).not.toBeNull();
      expect(repairedNullState.publishedAt!.getTime()).toBeLessThanOrEqual(Date.now());
      await expectVisibleToParticipant(
        participantPage,
        repairedNullState,
        PUBLICATION_NULL_TITLE,
      );

      const scheduledState = await readOpportunityState(PUBLICATION_SCHEDULED_TITLE);
      const scheduledAt = scheduledState.publishedAt?.getTime();
      expect(scheduledState.status).toBe("published");
      expect(scheduledAt).toBeGreaterThan(Date.now());
      await saveOrganizationStatus(
        organizationPage,
        scheduledState,
        "published",
        "予約日時を維持した説明です。",
      );
      const editedScheduledState = await readOpportunityState(PUBLICATION_SCHEDULED_TITLE);
      expect(editedScheduledState.publishedAt?.getTime()).toBe(scheduledAt);
      await expectHiddenFromParticipant(
        participantPage,
        editedScheduledState,
        PUBLICATION_SCHEDULED_TITLE,
      );
      await participantPage.goto("/recommendations");
      await expect(
        participantPage.getByText(PUBLICATION_SCHEDULED_TITLE, { exact: true }),
      ).toHaveCount(0);

      const closedState = await readOpportunityState(PUBLICATION_CLOSED_TITLE);
      const closedPublishedAt = closedState.publishedAt?.getTime();
      await expectHiddenFromParticipant(participantPage, closedState, PUBLICATION_CLOSED_TITLE);
      await saveOrganizationStatus(
        organizationPage,
        closedState,
        "published",
        "募集終了から再公開した説明です。",
      );
      const reopenedState = await readOpportunityState(PUBLICATION_CLOSED_TITLE);
      expect(reopenedState.status).toBe("published");
      expect(reopenedState.publishedAt?.getTime()).toBeGreaterThan(closedPublishedAt ?? 0);
      expect(reopenedState.publishedAt!.getTime()).toBeLessThanOrEqual(Date.now());
      await expectVisibleToParticipant(participantPage, reopenedState, PUBLICATION_CLOSED_TITLE);
    } finally {
      await organizationContext.close();
      await participantContext.close();
    }
  });
});

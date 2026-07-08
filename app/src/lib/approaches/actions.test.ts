import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFindOrganization = vi.fn();
const mockFindParticipant = vi.fn();
const mockFindParticipantByUserId = vi.fn();
const mockFindOpportunities = vi.fn();
const mockFindOpportunity = vi.fn();
const mockFindApproach = vi.fn();
const mockFindApproaches = vi.fn();
const mockCountApproaches = vi.fn();
const mockCreateApproach = vi.fn();
const mockUpdateApproach = vi.fn();
const mockFindTemplates = vi.fn();
const mockUpsertTemplate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationProfile: {
      findUnique: (...args: unknown[]) => mockFindOrganization(...args),
    },
    participantProfile: {
      findUnique: (...args: unknown[]) => {
        const [query] = args as [{ where?: { id?: string; userId?: string } }];
        if (query.where?.userId) {
          return mockFindParticipantByUserId(...args);
        }
        return mockFindParticipant(...args);
      },
      findMany: vi.fn(),
    },
    opportunity: {
      findMany: (...args: unknown[]) => mockFindOpportunities(...args),
      findFirst: (...args: unknown[]) => mockFindOpportunity(...args),
    },
    approach: {
      findFirst: (...args: unknown[]) => mockFindApproach(...args),
      findMany: (...args: unknown[]) => mockFindApproaches(...args),
      count: (...args: unknown[]) => mockCountApproaches(...args),
      create: (...args: unknown[]) => mockCreateApproach(...args),
      update: (...args: unknown[]) => mockUpdateApproach(...args),
    },
    messageTemplate: {
      findMany: (...args: unknown[]) => mockFindTemplates(...args),
      upsert: (...args: unknown[]) => mockUpsertTemplate(...args),
    },
  },
}));

const { APPROACH_MESSAGE_MAX_LENGTH } = await import("./constants");

const {
  fetchApproachSendData,
  fetchDashboardApproaches,
  fetchMyApproachDetail,
  fetchMyApproaches,
  respondToApproach,
  saveApproachTemplate,
  sendApproach,
} = await import("./actions");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-16T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

const approvedOrganization = {
  id: "org-profile-1",
  organizationName: "テスト団体",
  reviewStatus: "approved",
  contactEmail: "contact@example.org",
  contactLineId: "@volunty",
  contactLineUrl: "https://line.me/R/ti/p/@volunty",
};

const publicParticipant = {
  id: "participant-profile-1",
  userId: "participant-user-1",
  name: "山田 花子",
  region: "東京都",
  bio: "地域活動に関心があります",
  interests: ["環境保全"],
  preferredLocation: "東京都",
  publicProfile: true,
  latestDiagnosisResult: { styleTypeId: "innovator-leader" },
};

const publishedOpportunity = {
  id: "opportunity-1",
  title: "地域イベント運営",
  status: "published",
  requirementTraits: {
    extraversion: 80,
    agreeableness: 60,
    conscientiousness: 70,
    neuroticism: 30,
    openness: 90,
  },
};

describe("sendApproach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "org-user-1" } } });
    mockFindOrganization.mockResolvedValue(approvedOrganization);
    mockFindParticipant.mockResolvedValue(publicParticipant);
    mockFindOpportunity.mockResolvedValue(publishedOpportunity);
    mockFindApproach.mockResolvedValue(null);
    mockCountApproaches.mockResolvedValue(0);
    mockCreateApproach.mockResolvedValue({ id: "approach-1" });
  });

  it("承認済み団体が公開参加者へ公開中案件のアプローチを送信できる", async () => {
    const result = await sendApproach({
      participantProfileId: "participant-profile-1",
      opportunityId: "opportunity-1",
      message: "ぜひ一緒に活動しませんか。",
    });

    expect(result).toEqual({ success: true, approachId: "approach-1" });
    expect(mockFindOrganization).toHaveBeenCalledWith({
      where: { userId: "org-user-1" },
      select: expect.objectContaining({
        id: true,
        reviewStatus: true,
      }),
    });
    expect(mockFindOpportunity).toHaveBeenCalledWith({
      where: {
        id: "opportunity-1",
        organizationId: "org-profile-1",
        status: "published",
      },
      select: expect.objectContaining({
        id: true,
        title: true,
      }),
    });
    expect(mockCreateApproach).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-profile-1",
        participantProfileId: "participant-profile-1",
        opportunityId: "opportunity-1",
        message: "ぜひ一緒に活動しませんか。",
        expiresAt: new Date("2026-06-30T00:00:00.000Z"),
      }),
      select: { id: true },
    });
    // 旧マッチングスコアは保存しない
    const createArgs = mockCreateApproach.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data).not.toHaveProperty("matchScore");
  });

  it("未承認団体はアプローチを送信できない", async () => {
    mockFindOrganization.mockResolvedValue({
      ...approvedOrganization,
      reviewStatus: "pending",
    });

    const result = await sendApproach({
      participantProfileId: "participant-profile-1",
      opportunityId: "opportunity-1",
      message: "こんにちは",
    });

    expect(result).toEqual({
      success: false,
      error: "承認済み団体のみ利用できます",
    });
    expect(mockCreateApproach).not.toHaveBeenCalled();
  });

  it("同一団体・同一参加者・同一案件への重複アプローチを防ぐ", async () => {
    mockFindApproach.mockResolvedValue({ id: "approach-existing" });

    const result = await sendApproach({
      participantProfileId: "participant-profile-1",
      opportunityId: "opportunity-1",
      message: "もう一度送ります",
    });

    expect(result).toEqual({
      success: false,
      error: "この参加者にはこの案件ですでにアプローチ済みです",
    });
    expect(mockCreateApproach).not.toHaveBeenCalled();
  });

  it("空のメッセージは送信できない", async () => {
    const result = await sendApproach({
      participantProfileId: "participant-profile-1",
      opportunityId: "opportunity-1",
      message: "   ",
    });

    expect(result).toEqual({
      success: false,
      error: "アプローチ文を入力してください",
    });
    expect(mockCreateApproach).not.toHaveBeenCalled();
  });

  it("1000文字超のアプローチ文は送信できない", async () => {
    const result = await sendApproach({
      participantProfileId: "participant-profile-1",
      opportunityId: "opportunity-1",
      message: "あ".repeat(APPROACH_MESSAGE_MAX_LENGTH + 1),
    });

    expect(result).toEqual({
      success: false,
      error: "アプローチ文は1000文字以内で入力してください",
    });
    expect(mockCreateApproach).not.toHaveBeenCalled();
  });

  it("過去24時間の送信数が20件以上の場合は送信できない", async () => {
    mockCountApproaches.mockResolvedValueOnce(20);

    const result = await sendApproach({
      participantProfileId: "participant-profile-1",
      opportunityId: "opportunity-1",
      message: "こんにちは",
    });

    expect(result).toEqual({
      success: false,
      error: "1日に送信できるアプローチ数の上限に達しました",
    });
    expect(mockCountApproaches).toHaveBeenCalledWith({
      where: {
        organizationId: "org-profile-1",
        createdAt: { gte: new Date("2026-06-15T00:00:00.000Z") },
      },
    });
    expect(mockCreateApproach).not.toHaveBeenCalled();
  });

  it("対象参加者の未回答アプローチが10件以上の場合は送信できない", async () => {
    mockCountApproaches.mockResolvedValueOnce(0).mockResolvedValueOnce(10);

    const result = await sendApproach({
      participantProfileId: "participant-profile-1",
      opportunityId: "opportunity-1",
      message: "こんにちは",
    });

    expect(result).toEqual({
      success: false,
      error: "この参加者は未回答のアプローチが多いため、現在は送信できません",
    });
    expect(mockCountApproaches).toHaveBeenLastCalledWith({
      where: {
        participantProfileId: "participant-profile-1",
        status: "sent",
        expiresAt: { gt: new Date("2026-06-16T00:00:00.000Z") },
      },
    });
    expect(mockCreateApproach).not.toHaveBeenCalled();
  });

  it("Prisma の unique 制約違反は重複送信として扱う", async () => {
    mockCreateApproach.mockRejectedValue({ code: "P2002" });

    const result = await sendApproach({
      participantProfileId: "participant-profile-1",
      opportunityId: "opportunity-1",
      message: "こんにちは",
    });

    expect(result).toEqual({
      success: false,
      error: "この参加者にはこの案件ですでにアプローチ済みです",
    });
  });
});

describe("participant approach responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({
      data: { user: { id: "participant-user-1" } },
    });
    mockFindParticipantByUserId.mockResolvedValue({
      id: "participant-profile-1",
    });
  });

  it("参加者は自分宛てのアプローチ一覧を取得できる", async () => {
    mockFindApproaches.mockResolvedValue([
      {
        id: "approach-1",
        status: "sent",
        message: "ぜひ参加してください",
        matchScore: 92,
        respondedAt: null,
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        expiresAt: new Date("2026-06-30T00:00:00.000Z"),
        opportunity: { id: "opportunity-1", title: "地域イベント運営" },
        organization: {
          organizationName: "テスト団体",
          contactEmail: "contact@example.org",
          contactLineId: "@volunty",
          contactLineUrl: null,
        },
      },
    ]);

    const result = await fetchMyApproaches();

    expect(result.error).toBeUndefined();
    expect(result.approaches).toHaveLength(1);
    expect(result.approaches[0]).toMatchObject({
      id: "approach-1",
      status: "sent",
      organizationName: "テスト団体",
      opportunityTitle: "地域イベント運営",
      contact: null,
    });
  });

  it("承諾後のみ参加者向け詳細に団体連絡先を含める", async () => {
    mockFindApproach.mockResolvedValue({
      id: "approach-1",
      status: "accepted",
      message: "ぜひ参加してください",
      matchScore: 92,
      respondedAt: new Date("2026-06-16T11:00:00.000Z"),
      createdAt: new Date("2026-06-16T10:00:00.000Z"),
      expiresAt: new Date("2026-06-30T00:00:00.000Z"),
      opportunity: { id: "opportunity-1", title: "地域イベント運営" },
      organization: approvedOrganization,
    });

    const result = await fetchMyApproachDetail("approach-1");

    expect(result.approach).toMatchObject({
      id: "approach-1",
      status: "accepted",
      contact: {
        email: "contact@example.org",
        lineId: "@volunty",
        lineUrl: "https://line.me/R/ti/p/@volunty",
      },
    });
  });

  it("参加者は未回答のアプローチを承諾できる", async () => {
    mockFindApproach.mockResolvedValue({
      id: "approach-1",
      status: "sent",
      expiresAt: new Date("2026-06-30T00:00:00.000Z"),
    });
    mockUpdateApproach.mockResolvedValue({ id: "approach-1" });

    const result = await respondToApproach("approach-1", "accepted");

    expect(result).toEqual({ success: true, approachId: "approach-1" });
    expect(mockUpdateApproach).toHaveBeenCalledWith({
      where: { id: "approach-1" },
      data: expect.objectContaining({
        status: "accepted",
        respondedAt: expect.any(Date),
      }),
      select: { id: true },
    });
  });

  it("回答済みアプローチには再回答できない", async () => {
    mockFindApproach.mockResolvedValue({
      id: "approach-1",
      status: "accepted",
      expiresAt: new Date("2026-06-30T00:00:00.000Z"),
    });

    const result = await respondToApproach("approach-1", "declined");

    expect(result).toEqual({
      success: false,
      error: "このアプローチはすでに回答済みです",
    });
    expect(mockUpdateApproach).not.toHaveBeenCalled();
  });

  it("期限切れのアプローチは承諾/辞退できない", async () => {
    mockFindApproach.mockResolvedValue({
      id: "approach-1",
      status: "sent",
      expiresAt: new Date("2026-06-15T23:59:59.000Z"),
    });

    const result = await respondToApproach("approach-1", "accepted");

    expect(result).toEqual({
      success: false,
      error: "このアプローチの回答期限は過ぎています",
    });
    expect(mockUpdateApproach).not.toHaveBeenCalled();
  });

  it("lineUrl または email のみでも承諾後の連絡先表示対象になる", async () => {
    mockFindApproach.mockResolvedValue({
      id: "approach-1",
      status: "accepted",
      message: "ぜひ参加してください",
      matchScore: 92,
      respondedAt: new Date("2026-06-16T11:00:00.000Z"),
      createdAt: new Date("2026-06-16T10:00:00.000Z"),
      expiresAt: new Date("2026-06-30T00:00:00.000Z"),
      opportunity: { id: "opportunity-1", title: "地域イベント運営" },
      organization: {
        organizationName: "テスト団体",
        contactEmail: "contact@example.org",
        contactLineId: null,
        contactLineUrl: null,
      },
    });

    const result = await fetchMyApproachDetail("approach-1");

    expect(result.approach?.contact).toEqual({
      email: "contact@example.org",
      lineId: null,
      lineUrl: null,
    });
    expect(result.approach?.hasContact).toBe(true);
  });
});

describe("dashboard approach views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "org-user-1" } } });
    mockFindOrganization.mockResolvedValue(approvedOrganization);
  });

  it("送信フォーム用に参加者と自団体の公開中案件を取得できる", async () => {
    mockFindParticipant.mockResolvedValue(publicParticipant);
    mockFindOpportunities.mockResolvedValue([publishedOpportunity]);
    mockFindApproaches.mockResolvedValue([]);
    mockFindTemplates.mockResolvedValue([
      {
        id: "template-1",
        name: "初回案内",
        body: "{participantName}さん、{opportunityTitle}に参加しませんか。",
      },
    ]);

    const result = await fetchApproachSendData("participant-profile-1");

    expect(result.participant).toMatchObject({
      id: "participant-profile-1",
      name: "山田 花子",
    });
    expect(result.opportunities).toEqual([
      {
        id: "opportunity-1",
        title: "地域イベント運営",
        alreadyApproached: false,
      },
    ]);
    expect(result.templates).toEqual([
      {
        id: "template-1",
        name: "初回案内",
        body: "{participantName}さん、{opportunityTitle}に参加しませんか。",
      },
    ]);
    expect(mockFindTemplates).toHaveBeenCalledWith({
      where: { organizationId: "org-profile-1" },
      select: { id: true, name: true, body: true },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    });
  });

  it("団体は送信済みアプローチ履歴を取得できる", async () => {
    mockFindApproaches.mockResolvedValue([
      {
        id: "approach-1",
        status: "declined",
        message: "ぜひ参加してください",
        matchScore: 88,
        respondedAt: new Date("2026-06-16T12:00:00.000Z"),
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        expiresAt: new Date("2026-06-30T00:00:00.000Z"),
        participantProfile: { id: "participant-profile-1", name: "山田 花子" },
        opportunity: { id: "opportunity-1", title: "地域イベント運営" },
      },
    ]);

    const result = await fetchDashboardApproaches();

    expect(result.approaches).toEqual([
      expect.objectContaining({
        id: "approach-1",
        participantName: "山田 花子",
        opportunityTitle: "地域イベント運営",
        status: "declined",
      }),
    ]);
  });
});

describe("saveApproachTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "org-user-1" } } });
    mockFindOrganization.mockResolvedValue(approvedOrganization);
  });

  it("自団体のテンプレートを保存できる", async () => {
    mockUpsertTemplate.mockResolvedValue({ id: "template-1" });

    const result = await saveApproachTemplate({
      name: "初回案内",
      body: "こんにちは、ぜひ参加してください。",
    });

    expect(result).toEqual({ success: true, templateId: "template-1" });
    expect(mockUpsertTemplate).toHaveBeenCalledWith({
      where: {
        organizationId_name: {
          organizationId: "org-profile-1",
          name: "初回案内",
        },
      },
      create: {
        organizationId: "org-profile-1",
        name: "初回案内",
        body: "こんにちは、ぜひ参加してください。",
      },
      update: {
        body: "こんにちは、ぜひ参加してください。",
      },
      select: { id: true },
    });
  });

  it("テンプレート本文は1000文字以内に制限する", async () => {
    const result = await saveApproachTemplate({
      name: "長文",
      body: "あ".repeat(APPROACH_MESSAGE_MAX_LENGTH + 1),
    });

    expect(result).toEqual({
      success: false,
      error: "テンプレート本文は1000文字以内で入力してください",
    });
    expect(mockUpsertTemplate).not.toHaveBeenCalled();
  });
});

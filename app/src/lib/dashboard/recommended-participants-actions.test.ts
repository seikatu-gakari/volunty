import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RecommendedParticipantDetailResult,
  RecommendedParticipantsResult,
} from "./types";

vi.mock("server-only", () => ({}));

const mockGetUser = vi.fn();
const mockFindOrganizationProfile = vi.fn();
const mockFindOpportunities = vi.fn();
const mockFindParticipants = vi.fn();
const mockFindParticipant = vi.fn();

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
      findUnique: (...args: unknown[]) => mockFindOrganizationProfile(...args),
    },
    opportunity: {
      findMany: (...args: unknown[]) => mockFindOpportunities(...args),
    },
    participantProfile: {
      findMany: (...args: unknown[]) => mockFindParticipants(...args),
      findUnique: (...args: unknown[]) => mockFindParticipant(...args),
    },
  },
}));

const { fetchRecommendedParticipantDetail, fetchRecommendedParticipants } =
  await import("./actions");

const completeScores = {
  extraversion: 50,
  agreeableness: 50,
  conscientiousness: 50,
  emotionalStability: 50,
  intellect: 50,
};

const approvedOrganization = {
  id: "org-profile-1",
  reviewStatus: "approved",
  user: { role: "organization" },
};

describe("fetchRecommendedParticipants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "org-user-1" } } });
    mockFindOrganizationProfile.mockResolvedValue(approvedOrganization);
    mockFindOpportunities.mockResolvedValue([
      {
        id: "opp-1",
        title: "イベントリーダー",
        activityStyleTags: ["talk-with-new-people"],
      },
    ]);
    mockFindParticipants.mockResolvedValue([
      {
        id: "profile-1",
        userId: "participant-1",
        name: "山田 花子",
        region: "東京都",
        bio: "地域活動が好きです",
        interests: ["環境保全"],
        availability: null,
        preferredLocation: null,
        publicProfile: true,
        latestDiagnosisResult: {
          styleTypeId: "innovator-leader",
          scaledScores: { ...completeScores, extraversion: 80 },
        },
      },
    ]);
  });

  it("未ログインの場合はエラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: null } });

    const result: RecommendedParticipantsResult =
      await fetchRecommendedParticipants();

    expect(result.participants).toEqual([]);
    expect(result.error).toBe("ログインが必要です");
  });

  it("未承認団体の場合はエラーを返す", async () => {
    mockFindOrganizationProfile.mockResolvedValue({
      id: "org-profile-1",
      reviewStatus: "pending",
      user: { role: "organization" },
    });

    const result: RecommendedParticipantsResult =
      await fetchRecommendedParticipants();

    expect(result.participants).toEqual([]);
    expect(result.error).toBe("承認済み団体のみ利用できます");
  });

  it("公開中募集案件がない場合は空状態理由を返す", async () => {
    mockFindOpportunities.mockResolvedValue([]);

    const result: RecommendedParticipantsResult =
      await fetchRecommendedParticipants();

    expect(result.participants).toEqual([]);
    expect(result.emptyReason).toBe("no_published_opportunities");
  });

  it("公開済み参加者を活動スタイル適合付きで返す（生スコアは含めない）", async () => {
    const result: RecommendedParticipantsResult =
      await fetchRecommendedParticipants();

    expect(mockFindOrganizationProfile).toHaveBeenCalledWith({
      where: { userId: "org-user-1" },
      select: {
        id: true,
        reviewStatus: true,
        user: { select: { role: true } },
      },
    });
    expect(mockFindOpportunities).toHaveBeenCalledWith({
      where: {
        organizationId: "org-profile-1",
        status: "published",
        publishedAt: { not: null, lte: expect.any(Date) },
      },
      select: { id: true, activityStyleTags: true, title: true },
    });
    expect(mockFindParticipants).toHaveBeenCalledWith({
      where: { publicProfile: true },
      select: expect.objectContaining({
        publicProfile: true,
        latestDiagnosisResult: {
          select: { styleTypeId: true, scaledScores: true },
        },
      }),
    });
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0]).toMatchObject({
      id: "profile-1",
      bestOpportunityTitle: "イベントリーダー",
      styleTypeLabel: "イノベーター・リーダータイプ",
    });
    expect(result.participants[0]).not.toHaveProperty("diagnosisScores");
  });
});

describe("fetchRecommendedParticipantDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "org-user-1" } } });
    mockFindOrganizationProfile.mockResolvedValue(approvedOrganization);
    mockFindOpportunities.mockResolvedValue([
      {
        id: "opp-1",
        title: "イベントリーダー",
        activityStyleTags: ["talk-with-new-people"],
      },
    ]);
    mockFindParticipant.mockResolvedValue({
      id: "profile-1",
      userId: "participant-1",
      name: "山田 花子",
      region: "東京都",
      bio: "地域活動が好きです",
      interests: ["環境保全"],
      availability: null,
      preferredLocation: null,
      publicProfile: true,
      latestDiagnosisResult: {
        styleTypeId: "innovator-leader",
        scaledScores: { ...completeScores, extraversion: 80 },
      },
    });
  });

  it("指定参加者が公開済みの場合は詳細を返す", async () => {
    const result: RecommendedParticipantDetailResult =
      await fetchRecommendedParticipantDetail("profile-1");

    expect(mockFindParticipant).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      select: expect.objectContaining({
        publicProfile: true,
        latestDiagnosisResult: {
          select: { styleTypeId: true, scaledScores: true },
        },
      }),
    });
    expect(result.participant).toMatchObject({
      id: "profile-1",
      bestOpportunityId: "opp-1",
    });
  });

  it("非公開の参加者は詳細を返さない", async () => {
    mockFindParticipant.mockResolvedValue({
      id: "profile-1",
      userId: "participant-1",
      name: "山田 花子",
      region: "東京都",
      bio: null,
      interests: [],
      availability: null,
      preferredLocation: null,
      publicProfile: false,
      latestDiagnosisResult: null,
    });

    const result: RecommendedParticipantDetailResult =
      await fetchRecommendedParticipantDetail("profile-1");

    expect(result.participant).toBeNull();
    expect(result.error).toBe("参加者が見つかりません");
  });
});

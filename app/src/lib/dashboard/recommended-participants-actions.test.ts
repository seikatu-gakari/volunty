import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RecommendedParticipantDetailResult,
  RecommendedParticipantsResult,
} from "./types";

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
  agreeableness: 50,
  conscientiousness: 50,
  extraversion: 50,
  neuroticism: 50,
  openness: 50,
};

const approvedOrganization = {
  id: "org-profile-1",
  reviewStatus: "approved",
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
        requirementTraits: { extraversion: 80 },
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
        diagnosisType: "innovator-leader",
        diagnosisMode: "brief",
        diagnosisScores: { ...completeScores, extraversion: 80 },
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

  it("公開済み・診断済み参加者を相性スコア順で返す", async () => {
    const result: RecommendedParticipantsResult =
      await fetchRecommendedParticipants();

    expect(mockFindOrganizationProfile).toHaveBeenCalledWith({
      where: { userId: "org-user-1" },
      select: { id: true, reviewStatus: true },
    });
    expect(mockFindOpportunities).toHaveBeenCalledWith({
      where: { organizationId: "org-profile-1", status: "published" },
      select: { id: true, requirementTraits: true, title: true },
    });
    expect(mockFindParticipants).toHaveBeenCalledWith({
      where: { publicProfile: true },
      select: expect.objectContaining({
        diagnosisScores: true,
        publicProfile: true,
      }),
    });
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0]).toMatchObject({
      id: "profile-1",
      matchScore: 100,
      bestOpportunityTitle: "イベントリーダー",
    });
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
        requirementTraits: { extraversion: 80 },
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
      diagnosisType: "innovator-leader",
      diagnosisMode: "brief",
      diagnosisScores: { ...completeScores, extraversion: 80 },
    });
  });

  it("指定参加者が公開済み・診断済みの場合は詳細を返す", async () => {
    const result: RecommendedParticipantDetailResult =
      await fetchRecommendedParticipantDetail("profile-1");

    expect(mockFindParticipant).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      select: expect.objectContaining({
        diagnosisScores: true,
        publicProfile: true,
      }),
    });
    expect(result.participant).toMatchObject({
      id: "profile-1",
      matchScore: 100,
      bestOpportunityId: "opp-1",
    });
  });

  it("非公開または診断未実施の参加者は詳細を返さない", async () => {
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
      diagnosisType: null,
      diagnosisMode: null,
      diagnosisScores: completeScores,
    });

    const result: RecommendedParticipantDetailResult =
      await fetchRecommendedParticipantDetail("profile-1");

    expect(result.participant).toBeNull();
    expect(result.error).toBe("参加者が見つかりません");
  });
});

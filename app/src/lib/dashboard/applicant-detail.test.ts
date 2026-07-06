import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFindOrganizationProfile = vi.fn();
const mockFindOwnedApplication = vi.fn();

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
    matchingCandidate: {
      findFirst: (...args: unknown[]) => mockFindOwnedApplication(...args),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/recommendations/matching", () => ({
  calculateMatchScore: vi.fn().mockReturnValue(75),
}));

const { fetchApplicantDetail } = await import("./actions");

const organizationProfile = { id: "organization-profile-1" };
const diagnosisScores = {
  extraversion: 65,
  agreeableness: 85,
  conscientiousness: 70,
  neuroticism: 35,
  openness: 60,
};

const ownedApplication = {
  id: "application-1",
  status: "applied",
  message: "応募メッセージです",
  matchScore: 82.5,
  appliedAt: new Date("2026-01-20T00:00:00.000Z"),
  statusChangedAt: new Date("2026-01-20T00:00:00.000Z"),
  participant: {
    name: "ユーザー名",
    participantProfile: {
      name: "プロフィール名",
      diagnosisType: "イノベーター・リーダータイプ",
      diagnosisScores: {
        extraversion: 10,
        agreeableness: 20,
        conscientiousness: 30,
        neuroticism: 40,
        openness: 50,
      },
    },
  },
  opportunity: {
    id: "opportunity-1",
    title: "環境保全ボランティア",
    requirementTraits: { agreeableness: 80 },
  },
  diagnosisResult: {
    big5Scores: diagnosisScores,
    personalityType: { typeId: "supporter-care" },
  },
};

describe("fetchApplicantDetail", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetUser.mockReturnValue({
      data: { user: { id: "organization-user-1" } },
      error: null,
    });
    mockFindOrganizationProfile.mockResolvedValue(organizationProfile);
    mockFindOwnedApplication.mockResolvedValue(ownedApplication);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("未認証の場合はエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result = await fetchApplicantDetail("application-1");

    expect(result).toEqual({ data: null, error: "ログインが必要です" });
    expect(mockFindOrganizationProfile).not.toHaveBeenCalled();
  });

  it("団体プロフィールがない場合はエラーを返す", async () => {
    mockFindOrganizationProfile.mockResolvedValue(null);

    const result = await fetchApplicantDetail("application-1");

    expect(result).toEqual({
      data: null,
      error: "団体プロフィールが見つかりません",
    });
    expect(mockFindOwnedApplication).not.toHaveBeenCalled();
  });

  it.each([
    ["存在しない応募ID", "missing-application"],
    ["他団体所有の応募ID", "foreign-application"],
  ])(
    "%sは所有権付き検索1回で同じ権限エラーを返す",
    async (_caseName, applicationId) => {
      mockFindOwnedApplication.mockResolvedValue(null);

      const result = await fetchApplicantDetail(applicationId);

      expect(result).toEqual({
        data: null,
        error: "この操作を行う権限がありません",
      });
      expect(mockFindOwnedApplication).toHaveBeenCalledTimes(1);
      expect(mockFindOwnedApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: applicationId,
            opportunity: { organizationId: "organization-profile-1" },
          },
        })
      );
    }
  );

  it("応募に関連付いた診断結果から参加者名・人物タイプ・BIG5を返す", async () => {
    const result = await fetchApplicantDetail("application-1");

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "application-1",
        status: "pending",
        message: "応募メッセージです",
        created_at: "2026-01-20T00:00:00Z",
        completed_at: null,
        participant_name: "プロフィール名",
        diagnosis_type: "サポーター・ケアタイプ",
        diagnosis_scores: diagnosisScores,
        match_score: 82.5,
        opportunity_id: "opportunity-1",
        opportunity_title: "環境保全ボランティア",
      })
    );
    expect(result.data?.personality_type_detail?.name).toBe(
      "サポーター・ケアタイプ"
    );
    expect(mockFindOrganizationProfile).toHaveBeenCalledWith({
      where: { userId: "organization-user-1" },
      select: { id: true },
    });
    expect(mockFindOwnedApplication).toHaveBeenCalledWith({
      where: {
        id: "application-1",
        opportunity: { organizationId: "organization-profile-1" },
      },
      select: {
        id: true,
        status: true,
        message: true,
        matchScore: true,
        appliedAt: true,
        statusChangedAt: true,
        participant: {
          select: {
            name: true,
            participantProfile: {
              select: {
                name: true,
                diagnosisType: true,
                diagnosisScores: true,
              },
            },
          },
        },
        opportunity: {
          select: { id: true, title: true, requirementTraits: true },
        },
        diagnosisResult: {
          select: {
            big5Scores: true,
            personalityType: { select: { typeId: true } },
          },
        },
      },
    });
  });

  it("関連診断がない既存応募は参加者プロフィールの診断へフォールバックする", async () => {
    mockFindOwnedApplication.mockResolvedValue({
      ...ownedApplication,
      diagnosisResult: null,
    });

    const result = await fetchApplicantDetail("application-1");

    expect(result.data).toEqual(
      expect.objectContaining({
        participant_name: "プロフィール名",
        diagnosis_type: "イノベーター・リーダータイプ",
        diagnosis_scores:
          ownedApplication.participant.participantProfile.diagnosisScores,
        match_score: 82.5,
      })
    );
    expect(result.data?.personality_type_detail).toEqual({
      name: "イノベーター・リーダータイプ",
      nameEn: "Innovator Leader",
      description: "新しいアイデアを積極的に提案し、チームを牽引する",
      strengths: expect.arrayContaining(["プロジェクトリーダー"]),
      suitableActivities: expect.arrayContaining(["イベント統括"]),
    });
  });

  it("完了済み応募の日付をミリ秒なしの既存形式で返す", async () => {
    mockFindOwnedApplication.mockResolvedValue({
      ...ownedApplication,
      status: "completed",
      appliedAt: new Date("2026-01-20T00:00:00.000Z"),
      statusChangedAt: new Date("2026-02-10T12:30:00.000Z"),
    });

    const result = await fetchApplicantDetail("application-1");

    expect(result.data).toEqual(
      expect.objectContaining({
        status: "completed",
        created_at: "2026-01-20T00:00:00Z",
        completed_at: "2026-02-10T12:30:00Z",
      })
    );
  });

  it("診断未実施でもユーザー名へフォールバックして詳細を返す", async () => {
    mockFindOwnedApplication.mockResolvedValue({
      ...ownedApplication,
      participant: {
        name: "未診断ユーザー",
        participantProfile: null,
      },
      diagnosisResult: null,
    });

    const result = await fetchApplicantDetail("application-1");

    expect(result.data).toEqual(
      expect.objectContaining({
        participant_name: "未診断ユーザー",
        diagnosis_type: null,
        diagnosis_scores: null,
        match_score: 82.5,
        personality_type_detail: null,
      })
    );
  });

  it("プロフィール名とユーザー名がない場合は不明を返す", async () => {
    mockFindOwnedApplication.mockResolvedValue({
      ...ownedApplication,
      participant: {
        name: null,
        participantProfile: null,
      },
      diagnosisResult: null,
    });

    const result = await fetchApplicantDetail("application-1");

    expect(result.data?.participant_name).toBe("不明");
  });

  it("Prisma例外時は予期しないエラーを返す", async () => {
    mockFindOwnedApplication.mockRejectedValue(new Error("DB error"));

    const result = await fetchApplicantDetail("application-1");

    expect(result).toEqual({
      data: null,
      error: "予期しないエラーが発生しました",
    });
  });
});

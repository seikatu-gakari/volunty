import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicantDetailResult } from "./types";

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

const { fetchApplicantDetail } = await import("./actions");

const organizationProfile = {
  id: "organization-profile-1",
  reviewStatus: "approved",
  user: { role: "organization" },
};

const ownedApplication = {
  id: "application-1",
  status: "applied",
  message: "応募メッセージです",
  appliedAt: new Date("2026-01-20T00:00:00.000Z"),
  statusChangedAt: new Date("2026-01-20T00:00:00.000Z"),
  participant: {
    name: "ユーザー名",
    participantProfile: {
      name: "プロフィール名",
      latestDiagnosisResult: { styleTypeId: "supporter-care" },
    },
  },
  opportunity: {
    id: "opportunity-1",
    title: "環境保全ボランティア",
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

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("application-1");

    expect(result).toEqual({ data: null, error: "ログインが必要です" });
    expect(mockFindOrganizationProfile).not.toHaveBeenCalled();
  });

  it("団体プロフィールがない場合はエラーを返す", async () => {
    mockFindOrganizationProfile.mockResolvedValue(null);

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("application-1");

    expect(result).toEqual({
      data: null,
      error: "団体プロフィールが見つかりません",
    });
    expect(mockFindOwnedApplication).not.toHaveBeenCalled();
  });

  it("DBロールが団体でない場合は応募を検索せずエラーを返す", async () => {
    mockFindOrganizationProfile.mockResolvedValue({
      ...organizationProfile,
      user: { role: "participant" },
    });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("application-1");

    expect(result).toEqual({
      data: null,
      error: "団体アカウントのみ利用できます",
    });
    expect(mockFindOwnedApplication).not.toHaveBeenCalled();
  });

  it("団体審査が承認済みでない場合は応募を検索せずエラーを返す", async () => {
    mockFindOrganizationProfile.mockResolvedValue({
      ...organizationProfile,
      reviewStatus: "pending",
    });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("application-1");

    expect(result).toEqual({
      data: null,
      error: "承認済み団体のみ利用できます",
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

      const result: ApplicantDetailResult =
        await fetchApplicantDetail(applicationId);

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

  it("応募者詳細は参考タイプだけを返し、生スコアと旧マッチングスコアを返さない", async () => {
    const result: ApplicantDetailResult =
      await fetchApplicantDetail("application-1");

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "application-1",
        status: "pending",
        message: "応募メッセージです",
        created_at: "2026-01-20T00:00:00Z",
        completed_at: null,
        participant_name: "プロフィール名",
        style_type_label: "サポーター・ケアタイプ",
        opportunity_id: "opportunity-1",
        opportunity_title: "環境保全ボランティア",
      })
    );
    expect(result.data?.style_type_detail).toEqual(
      expect.objectContaining({
        name: "サポーター・ケアタイプ",
        nameEn: "Supporter Care",
      })
    );
    expect(result.data).not.toHaveProperty("diagnosis_scores");
    expect(result.data).not.toHaveProperty("match_score");
    expect(mockFindOrganizationProfile).toHaveBeenCalledWith({
      where: { userId: "organization-user-1" },
      select: {
        id: true,
        reviewStatus: true,
        user: { select: { role: true } },
      },
    });
    expect(mockFindOwnedApplication).toHaveBeenCalledWith({
      where: {
        id: "application-1",
        opportunity: { organizationId: "organization-profile-1" },
      },
      select: expect.objectContaining({
        id: true,
        status: true,
        participant: expect.objectContaining({
          select: expect.objectContaining({
            participantProfile: expect.objectContaining({
              select: expect.objectContaining({
                latestDiagnosisResult: {
                  select: { styleTypeId: true },
                },
              }),
            }),
          }),
        }),
      }),
    });
  });

  it("完了済み応募の日付をミリ秒なしの既存形式で返す", async () => {
    mockFindOwnedApplication.mockResolvedValue({
      ...ownedApplication,
      status: "completed",
      appliedAt: new Date("2026-01-20T00:00:00.000Z"),
      statusChangedAt: new Date("2026-02-10T12:30:00.000Z"),
    });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("application-1");

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
    });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("application-1");

    expect(result.data).toEqual(
      expect.objectContaining({
        participant_name: "未診断ユーザー",
        style_type_label: null,
        style_type_detail: null,
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
    });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("application-1");

    expect(result.data?.participant_name).toBe("不明");
  });

  it("Prisma例外時は予期しないエラーを返す", async () => {
    mockFindOwnedApplication.mockRejectedValue(new Error("DB error"));

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("application-1");

    expect(result).toEqual({
      data: null,
      error: "予期しないエラーが発生しました",
    });
  });
});

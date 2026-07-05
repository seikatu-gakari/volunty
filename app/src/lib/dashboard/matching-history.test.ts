import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFindOrganizationProfile = vi.fn();
const mockFindMatchingCandidates = vi.fn();

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
      findMany: (...args: unknown[]) => mockFindMatchingCandidates(...args),
    },
  },
}));

const { fetchMatchingHistory } = await import("./actions");

const approvedOrganization = {
  id: "org-profile-1",
  reviewStatus: "approved",
  user: { role: "organization" },
};

describe("fetchMatchingHistory", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetUser.mockReturnValue({
      data: { user: { id: "organization-user-1" } },
      error: null,
    });
    mockFindOrganizationProfile.mockResolvedValue(approvedOrganization);
    mockFindMatchingCandidates.mockResolvedValue([]);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("未ログインの場合はエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "ログインしていません" },
    });

    const result = await fetchMatchingHistory();

    expect(result.history).toEqual([]);
    expect(result.error).toBe("ログインが必要です");
    expect(mockFindOrganizationProfile).not.toHaveBeenCalled();
  });

  it("団体プロフィールがない場合はエラーを返す", async () => {
    mockFindOrganizationProfile.mockResolvedValue(null);

    const result = await fetchMatchingHistory();

    expect(result.history).toEqual([]);
    expect(result.error).toBe("団体プロフィールが見つかりません");
  });

  it("団体ロール以外の場合はエラーを返す", async () => {
    mockFindOrganizationProfile.mockResolvedValue({
      ...approvedOrganization,
      user: { role: "participant" },
    });

    const result = await fetchMatchingHistory();

    expect(result.history).toEqual([]);
    expect(result.error).toBe("団体アカウントのみ利用できます");
    expect(mockFindMatchingCandidates).not.toHaveBeenCalled();
  });

  it("未承認団体の場合はエラーを返す", async () => {
    mockFindOrganizationProfile.mockResolvedValue({
      ...approvedOrganization,
      reviewStatus: "pending",
    });

    const result = await fetchMatchingHistory();

    expect(result.history).toEqual([]);
    expect(result.error).toBe("承認済み団体のみ利用できます");
    expect(mockFindMatchingCandidates).not.toHaveBeenCalled();
  });

  it("自団体の承認・辞退・活動完了済み応募を処理日時順で返す", async () => {
    mockFindMatchingCandidates.mockResolvedValue([
      {
        id: "application-completed",
        status: "completed",
        appliedAt: new Date("2026-06-01T08:00:00.000Z"),
        statusChangedAt: new Date("2026-06-11T09:00:00.000Z"),
        matchScore: 91,
        participant: {
          name: "完了 参加者",
          participantProfile: { name: "完了 花子" },
        },
        opportunity: {
          id: "opportunity-3",
          title: "活動完了案件",
        },
      },
      {
        id: "application-accepted",
        status: "accepted",
        appliedAt: new Date("2026-06-01T09:00:00.000Z"),
        statusChangedAt: new Date("2026-06-10T12:30:00.000Z"),
        matchScore: 87.4,
        participant: {
          name: "ユーザー名フォールバック",
          participantProfile: { name: "山田 花子" },
        },
        opportunity: {
          id: "opportunity-1",
          title: "地域清掃ボランティア",
        },
      },
      {
        id: "application-declined",
        status: "declined",
        appliedAt: null,
        statusChangedAt: new Date("2026-06-09T08:15:00.000Z"),
        matchScore: null,
        participant: {
          name: "佐藤 太郎",
          participantProfile: null,
        },
        opportunity: {
          id: "opportunity-2",
          title: "学習支援スタッフ",
        },
      },
    ]);

    const result = await fetchMatchingHistory();

    expect(result.error).toBeUndefined();
    expect(result.history).toEqual([
      {
        id: "application-completed",
        status: "completed",
        participant_name: "完了 花子",
        opportunity_id: "opportunity-3",
        opportunity_title: "活動完了案件",
        applied_at: "2026-06-01T08:00:00.000Z",
        status_changed_at: "2026-06-11T09:00:00.000Z",
        match_score: 91,
      },
      {
        id: "application-accepted",
        status: "approved",
        participant_name: "山田 花子",
        opportunity_id: "opportunity-1",
        opportunity_title: "地域清掃ボランティア",
        applied_at: "2026-06-01T09:00:00.000Z",
        status_changed_at: "2026-06-10T12:30:00.000Z",
        match_score: 87.4,
      },
      {
        id: "application-declined",
        status: "rejected",
        participant_name: "佐藤 太郎",
        opportunity_id: "opportunity-2",
        opportunity_title: "学習支援スタッフ",
        applied_at: null,
        status_changed_at: "2026-06-09T08:15:00.000Z",
        match_score: null,
      },
    ]);
    expect(mockFindOrganizationProfile).toHaveBeenCalledWith({
      where: { userId: "organization-user-1" },
      select: {
        id: true,
        reviewStatus: true,
        user: { select: { role: true } },
      },
    });
    expect(mockFindMatchingCandidates).toHaveBeenCalledWith({
      where: {
        status: { in: ["accepted", "declined", "completed"] },
        opportunity: { organizationId: "org-profile-1" },
      },
      select: expect.objectContaining({
        id: true,
        status: true,
        participant: expect.any(Object),
        opportunity: expect.any(Object),
      }),
      orderBy: [
        { statusChangedAt: "desc" },
        { appliedAt: "desc" },
        { id: "asc" },
      ],
    });
  });

  it("Prisma 例外時は予期しないエラーを返す", async () => {
    mockFindMatchingCandidates.mockRejectedValue(new Error("DB error"));

    const result = await fetchMatchingHistory();

    expect(result.history).toEqual([]);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

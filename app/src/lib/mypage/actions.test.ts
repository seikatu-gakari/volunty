import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MyPageData } from "./types";

// Supabase クライアントのモック（認証 + participant profile fallback）
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockEq(...eqArgs);
              return {
                maybeSingle: (...maybeSingleArgs: unknown[]) => {
                  mockMaybeSingle(...maybeSingleArgs);
                  return mockMaybeSingle();
                },
              };
            },
          };
        },
      };
    },
  }),
}));

// Prisma のモック（参加者プロフィール）
const mockPrismaParticipantFindUnique = vi.fn();
const mockPrismaMatchingFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    participantProfile: {
      findUnique: (...args: unknown[]) => mockPrismaParticipantFindUnique(...args),
    },
    matchingCandidate: {
      findMany: (...args: unknown[]) => mockPrismaMatchingFindMany(...args),
    },
  },
}));

// "use server" ディレクティブを含むモジュールの動的インポート
// テスト環境では Server Action として実行されず、通常の関数として呼び出される
const { fetchMyPageData } = await import("./actions");

describe("fetchMyPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、空のデータを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: MyPageData = await fetchMyPageData();

    expect(result.profile).toBeNull();
    expect(result.applications).toEqual([]);
  });

  it("認証済みでプロフィールがある場合、プロフィール情報を返す", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockProfile = {
      id: "user-123",
      name: "テストユーザー",
      region: "東京都",
      diagnosis_type: "イノベーター・リーダー",
      diagnosis_scores: { extraversion: 85, agreeableness: 70 },
    };

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue({
      id: mockProfile.id,
      name: mockProfile.name,
      region: mockProfile.region,
      diagnosisType: mockProfile.diagnosis_type,
      diagnosisScores: mockProfile.diagnosis_scores,
    });
    mockPrismaMatchingFindMany.mockResolvedValue([]);

    const result: MyPageData = await fetchMyPageData();

    expect(result.profile).toEqual(mockProfile);
    expect(mockPrismaMatchingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ participantId: "user-123" }),
      })
    );
  });

  it("応募データがある場合、応募一覧を返す", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockApplications = [
      {
        id: "app-1",
        status: "applied",
        message: "応募メッセージ",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        appliedAt: new Date("2026-01-01T00:00:00Z"),
        opportunity: {
          id: "opp-1",
          title: "環境保全ボランティア",
          organization: {
            organizationName: "NPO法人テスト",
            contactLineId: "@test_line",
          },
        },
      },
      {
        id: "app-2",
        status: "accepted",
        message: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        appliedAt: new Date("2026-01-02T00:00:00Z"),
        opportunity: {
          id: "opp-2",
          title: "子ども支援活動",
          organization: {
            organizationName: "支援団体A",
            contactLineId: "@support_line",
          },
        },
      },
    ];

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue(null);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockPrismaMatchingFindMany.mockResolvedValue(mockApplications);

    const result: MyPageData = await fetchMyPageData();

    expect(result.applications).toHaveLength(2);

    // pending の応募 — LINE ID は返さない
    const pendingApp = result.applications[0];
    expect(pendingApp.status).toBe("pending");
    expect(pendingApp.opportunity.title).toBe("環境保全ボランティア");
    expect(pendingApp.opportunity.organization_name).toBe("NPO法人テスト");
    expect(pendingApp.opportunity.organization_line_id).toBeNull();

    // approved の応募 — LINE ID を返す
    const approvedApp = result.applications[1];
    expect(approvedApp.status).toBe("approved");
    expect(approvedApp.opportunity.title).toBe("子ども支援活動");
    expect(approvedApp.opportunity.organization_name).toBe("支援団体A");
    expect(approvedApp.opportunity.organization_line_id).toBe("@support_line");
  });

  it("rejected の場合、LINE ID を返さない", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockApplications = [
      {
        id: "app-3",
        status: "declined",
        message: null,
        createdAt: new Date("2026-01-03T00:00:00Z"),
        appliedAt: new Date("2026-01-03T00:00:00Z"),
        opportunity: {
          id: "opp-3",
          title: "イベントスタッフ",
          organization: {
            organizationName: "イベント団体",
            contactLineId: "@event_line",
          },
        },
      },
      {
        id: "app-4",
        status: "completed",
        message: null,
        createdAt: new Date("2026-01-04T00:00:00Z"),
        appliedAt: new Date("2026-01-04T00:00:00Z"),
        opportunity: {
          id: "opp-4",
          title: "配布物作成サポート",
          organization: {
            organizationName: "制作団体",
            contactLineId: "@production_line",
          },
        },
      },
    ];

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue(null);
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockPrismaMatchingFindMany.mockResolvedValue(mockApplications);

    const result: MyPageData = await fetchMyPageData();

    const rejectedApp = result.applications[0];
    expect(rejectedApp.status).toBe("rejected");
    expect(rejectedApp.opportunity.organization_line_id).toBeNull();

    const completedApp = result.applications[1];
    expect(completedApp.status).toBe("approved");
    expect(completedApp.opportunity.organization_line_id).toBe(
      "@production_line"
    );
  });

  it("DB エラー時もクラッシュせず空データを返す", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    // DB アクセスで例外を投げる
    mockPrismaParticipantFindUnique.mockImplementation(() => {
      throw new Error("DB connection error");
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockPrismaMatchingFindMany.mockImplementation(() => {
      throw new Error("DB connection error");
    });

    const result: MyPageData = await fetchMyPageData();

    // エラーでもクラッシュせず空データを返す
    expect(result.profile).toBeNull();
    expect(result.applications).toEqual([]);
  });
});

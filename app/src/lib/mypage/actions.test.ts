import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MyPageData } from "./types";

// Supabase クライアントのモック（認証 + applications）
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

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
                order: (...orderArgs: unknown[]) => {
                  mockOrder(...orderArgs);
                  return mockOrder();
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    participantProfile: {
      findUnique: (...args: unknown[]) => mockPrismaParticipantFindUnique(...args),
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
    mockOrder.mockReturnValue({ data: [] });

    const result: MyPageData = await fetchMyPageData();

    expect(result.profile).toEqual(mockProfile);
    expect(mockFrom).toHaveBeenCalledWith("applications");
    expect(mockEq).toHaveBeenCalledWith("participant_id", "user-123");
  });

  it("応募データがある場合、応募一覧を返す", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    const mockApplications = [
      {
        id: "app-1",
        status: "pending",
        message: "応募メッセージ",
        created_at: "2026-01-01T00:00:00Z",
        opportunities: {
          id: "opp-1",
          title: "環境保全ボランティア",
          organizations: { name: "NPO法人テスト", line_id: "@test_line" },
        },
      },
      {
        id: "app-2",
        status: "approved",
        message: null,
        created_at: "2026-01-02T00:00:00Z",
        opportunities: {
          id: "opp-2",
          title: "子ども支援活動",
          organizations: { name: "支援団体A", line_id: "@support_line" },
        },
      },
    ];

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue(null);
    mockOrder.mockReturnValue({ data: mockApplications });

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
        status: "rejected",
        message: null,
        created_at: "2026-01-03T00:00:00Z",
        opportunities: {
          id: "opp-3",
          title: "イベントスタッフ",
          organizations: { name: "イベント団体", line_id: "@event_line" },
        },
      },
    ];

    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockPrismaParticipantFindUnique.mockResolvedValue(null);
    mockOrder.mockReturnValue({ data: mockApplications });

    const result: MyPageData = await fetchMyPageData();

    const rejectedApp = result.applications[0];
    expect(rejectedApp.status).toBe("rejected");
    expect(rejectedApp.opportunity.organization_line_id).toBeNull();
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
    mockOrder.mockImplementation(() => {
      throw new Error("DB connection error");
    });

    const result: MyPageData = await fetchMyPageData();

    // エラーでもクラッシュせず空データを返す
    expect(result.profile).toBeNull();
    expect(result.applications).toEqual([]);
  });
});

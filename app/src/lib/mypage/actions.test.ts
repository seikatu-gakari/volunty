import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyPageData } from "./types";

const mockGetUser = vi.fn();
const mockFetchParticipantProfileByUserId = vi.fn();

type MatchingRow = {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  applied_at: string | null;
  opportunity_id: string;
};

type OpportunityRow = {
  id: string;
  title: string;
  m_organization_profile:
    | { organization_name: string; contact_line_id: string | null }
    | Array<{ organization_name: string; contact_line_id: string | null }>
    | null;
};

let mockMatchingRows: MatchingRow[] = [];
let mockOpportunityRows: OpportunityRow[] = [];
let mockMatchingError: Error | null = null;

vi.mock("@/lib/participant-profile/server", () => ({
  fetchParticipantProfileByUserId: (...args: unknown[]) =>
    mockFetchParticipantProfileByUserId(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => {
          if (table === "t_matching_candidate") {
            return query;
          }
          if (table === "m_opportunity") {
            return Promise.resolve({ data: mockOpportunityRows, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        order: () => {
          if (mockMatchingError) {
            throw mockMatchingError;
          }
          return Promise.resolve({ data: mockMatchingRows, error: null });
        },
      };
      return query;
    },
  }),
}));

const { fetchMyPageData } = await import("./actions");

describe("fetchMyPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchingRows = [];
    mockOpportunityRows = [];
    mockMatchingError = null;
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
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockFetchParticipantProfileByUserId.mockResolvedValue({
      id: "user-123",
      name: "テストユーザー",
      region: "東京都",
      diagnosisType: "イノベーター・リーダー",
      diagnosisScores: { extraversion: 85, agreeableness: 70 },
    });

    const result: MyPageData = await fetchMyPageData();

    expect(result.profile).toEqual({
      id: "user-123",
      name: "テストユーザー",
      region: "東京都",
      diagnosis_type: "イノベーター・リーダー",
      diagnosis_scores: { extraversion: 85, agreeableness: 70 },
    });
  });

  it("応募データがある場合、応募一覧を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockFetchParticipantProfileByUserId.mockResolvedValue(null);
    mockMatchingRows = [
      {
        id: "app-1",
        status: "applied",
        message: "応募メッセージ",
        created_at: "2026-01-01T00:00:00.000Z",
        applied_at: "2026-01-01T00:00:00.000Z",
        opportunity_id: "opp-1",
      },
      {
        id: "app-2",
        status: "accepted",
        message: null,
        created_at: "2026-01-02T00:00:00.000Z",
        applied_at: "2026-01-02T00:00:00.000Z",
        opportunity_id: "opp-2",
      },
    ];
    mockOpportunityRows = [
      {
        id: "opp-1",
        title: "環境保全ボランティア",
        m_organization_profile: {
          organization_name: "NPO法人テスト",
          contact_line_id: "@test_line",
        },
      },
      {
        id: "opp-2",
        title: "子ども支援活動",
        m_organization_profile: {
          organization_name: "支援団体A",
          contact_line_id: "@support_line",
        },
      },
    ];

    const result: MyPageData = await fetchMyPageData();

    expect(result.applications).toHaveLength(2);

    const pendingApp = result.applications[1];
    expect(pendingApp.status).toBe("pending");
    expect(pendingApp.opportunity.title).toBe("環境保全ボランティア");
    expect(pendingApp.opportunity.organization_name).toBe("NPO法人テスト");
    expect(pendingApp.opportunity.organization_line_id).toBeNull();

    const approvedApp = result.applications[0];
    expect(approvedApp.status).toBe("approved");
    expect(approvedApp.opportunity.title).toBe("子ども支援活動");
    expect(approvedApp.opportunity.organization_name).toBe("支援団体A");
    expect(approvedApp.opportunity.organization_line_id).toBe("@support_line");
  });

  it("rejected の場合、LINE ID を返さない", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockFetchParticipantProfileByUserId.mockResolvedValue(null);
    mockMatchingRows = [
      {
        id: "app-3",
        status: "declined",
        message: null,
        created_at: "2026-01-03T00:00:00.000Z",
        applied_at: "2026-01-03T00:00:00.000Z",
        opportunity_id: "opp-3",
      },
      {
        id: "app-4",
        status: "completed",
        message: null,
        created_at: "2026-01-04T00:00:00.000Z",
        applied_at: "2026-01-04T00:00:00.000Z",
        opportunity_id: "opp-4",
      },
    ];
    mockOpportunityRows = [
      {
        id: "opp-3",
        title: "イベントスタッフ",
        m_organization_profile: {
          organization_name: "イベント団体",
          contact_line_id: "@event_line",
        },
      },
      {
        id: "opp-4",
        title: "配布物作成サポート",
        m_organization_profile: {
          organization_name: "制作団体",
          contact_line_id: "@production_line",
        },
      },
    ];

    const result: MyPageData = await fetchMyPageData();

    const rejectedApp = result.applications[1];
    expect(rejectedApp.status).toBe("rejected");
    expect(rejectedApp.opportunity.organization_line_id).toBeNull();

    const completedApp = result.applications[0];
    expect(completedApp.status).toBe("approved");
    expect(completedApp.opportunity.organization_line_id).toBe(
      "@production_line"
    );
  });

  it("DB エラー時もクラッシュせず空データを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockFetchParticipantProfileByUserId.mockResolvedValue(null);
    mockMatchingError = new Error("DB connection error");

    const result: MyPageData = await fetchMyPageData();

    expect(result.profile).toBeNull();
    expect(result.applications).toEqual([]);
  });
});

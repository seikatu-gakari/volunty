import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrganizationDetailResult } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

// チェーン可能なモックビルダー
function createChainMock() {
  return {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        eq: (...eqArgs: unknown[]) => {
          mockEq(...eqArgs);
          return {
            single: () => mockSingle(),
            eq: (...eqArgs2: unknown[]) => {
              mockEq(...eqArgs2);
              return {
                data: [],
                error: null,
              };
            },
          };
        },
      };
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      mockFrom(table);
      return createChainMock();
    },
  }),
}));

vi.mock("@/lib/recommendations/matching", () => ({
  calculateMatchScore: vi.fn().mockReturnValue(75),
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { fetchOrganizationDetail } = await import("./actions");

describe("fetchOrganizationDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、空のデータを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: OrganizationDetailResult =
      await fetchOrganizationDetail("org-1");

    expect(result.organization).toBeNull();
    expect(result.opportunities).toEqual([]);
    expect(result.isParticipant).toBe(false);
  });

  it("団体が存在しない場合、organization が null を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // organizations テーブルからの取得が null
    mockSingle.mockReturnValue({ data: null, error: { code: "PGRST116" } });

    const result: OrganizationDetailResult =
      await fetchOrganizationDetail("nonexistent");

    expect(result.organization).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("organizations");
  });

  it("団体が存在する場合、団体詳細を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const mockOrg = {
      id: "org-1",
      name: "NPO法人テスト",
      description: "テスト団体の説明です",
    };

    // organizations → single, participants → single
    let singleCallCount = 0;
    mockSingle.mockImplementation(() => {
      singleCallCount++;
      if (singleCallCount === 1) return { data: mockOrg, error: null };
      return { data: null, error: null }; // participants (非参加者)
    });

    // opportunities の eq チェーン（single は呼ばれない）
    const mockOppData = [
      {
        id: "opp-1",
        title: "環境保全ボランティア",
        description: "森林保全活動",
        required_traits: { extraversion: 70, agreeableness: 80 },
      },
    ];

    // eq の 2 番目のチェーンは opportunities の結果を返す
    let eqCallCount = 0;
    mockEq.mockImplementation(() => {
      eqCallCount++;
      // organizations.eq("id", ...) → single 付きオブジェクト
      if (eqCallCount === 1) {
        return {
          single: () => mockSingle(),
        };
      }
      // participants.eq("id", ...) → single 付きオブジェクト
      if (eqCallCount === 2) {
        return {
          single: () => mockSingle(),
        };
      }
      // opportunities.eq("organization_id", ...) → eq チェーン
      if (eqCallCount === 3) {
        return {
          eq: () => {
            eqCallCount++;
            return { data: mockOppData, error: null };
          },
        };
      }
      return { data: mockOppData, error: null };
    });

    const result: OrganizationDetailResult =
      await fetchOrganizationDetail("org-1");

    expect(result.organization).not.toBeNull();
    expect(result.organization?.name).toBe("NPO法人テスト");
    expect(result.organization?.description).toBe("テスト団体の説明です");
    expect(result.isParticipant).toBe(false);
  });

  it("予期しないエラー時もクラッシュせず空データを返す", async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const result: OrganizationDetailResult =
      await fetchOrganizationDetail("org-1");

    expect(result.organization).toBeNull();
    expect(result.opportunities).toEqual([]);
    expect(result.isParticipant).toBe(false);
  });
});

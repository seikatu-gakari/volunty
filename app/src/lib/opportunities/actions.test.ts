import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OpportunityDetailResult, ApplyResult } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();

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
                single: () => mockSingle(),
              };
            },
          };
        },
      };
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return mockInsert();
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
const { fetchOpportunityDetail, applyToOpportunity } = await import(
  "./actions"
);

describe("fetchOpportunityDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、空のデータを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("opp-1");

    expect(result.opportunity).toBeNull();
    expect(result.matchScore).toBeNull();
    expect(result.existingApplication).toBeNull();
    expect(result.isParticipant).toBe(false);
  });

  it("案件が存在しない場合、opportunity が null を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // opportunities テーブルからの取得が null
    mockSingle.mockReturnValue({ data: null, error: { code: "PGRST116" } });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("nonexistent");

    expect(result.opportunity).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("opportunities");
  });

  it("案件が存在する場合、案件詳細を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // 案件データ
    const mockOpp = {
      id: "opp-1",
      title: "環境保全ボランティア",
      description: "森林保全活動です",
      required_traits: { extraversion: 70, agreeableness: 80 },
      status: "open",
      created_at: "2026-01-01T00:00:00Z",
      organizations: { id: "org-1", name: "NPO法人テスト", description: "テスト団体です" },
    };

    // 参加者データ
    const mockParticipant = {
      diagnosis_scores: {
        extraversion: 75,
        agreeableness: 80,
        conscientiousness: 60,
        neuroticism: 40,
        openness: 70,
      },
    };

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: mockOpp, error: null }; // opportunities
      if (callCount === 2) return { data: mockParticipant, error: null }; // participants
      return { data: null, error: null }; // applications (応募なし)
    });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("opp-1");

    expect(result.opportunity).not.toBeNull();
    expect(result.opportunity?.title).toBe("環境保全ボランティア");
    expect(result.opportunity?.description).toBe("森林保全活動です");
    expect(result.opportunity?.organization.name).toBe("NPO法人テスト");
    expect(result.opportunity?.status).toBe("open");
    expect(result.isParticipant).toBe(true);
    expect(result.matchScore).toBe(75); // モックされた calculateMatchScore の戻り値
    expect(result.existingApplication).toBeNull();
  });

  it("応募済みの場合、existingApplication を含める", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const mockOpp = {
      id: "opp-1",
      title: "子ども支援活動",
      description: null,
      required_traits: null,
      status: "open",
      created_at: "2026-01-01T00:00:00Z",
      organizations: { id: "org-2", name: "支援団体A", description: null },
    };

    const mockApp = {
      id: "app-1",
      status: "pending",
      message: "参加したいです",
      created_at: "2026-01-15T00:00:00Z",
    };

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: mockOpp, error: null }; // opportunities
      if (callCount === 2) return { data: null, error: null }; // participants (非参加者)
      return { data: mockApp, error: null }; // applications
    });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("opp-1");

    expect(result.existingApplication).not.toBeNull();
    expect(result.existingApplication?.status).toBe("pending");
    expect(result.existingApplication?.message).toBe("参加したいです");
  });

  it("予期しないエラー時もクラッシュせず空データを返す", async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const result: OpportunityDetailResult =
      await fetchOpportunityDetail("opp-1");

    expect(result.opportunity).toBeNull();
    expect(result.matchScore).toBeNull();
    expect(result.existingApplication).toBeNull();
    expect(result.isParticipant).toBe(false);
  });
});

describe("applyToOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("ログインが必要です");
  });

  it("参加者でない場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // participants テーブルに該当なし
    mockSingle.mockReturnValue({ data: null, error: null });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("参加者登録が必要です");
  });

  it("案件が存在しない場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: { id: "user-123" }, error: null }; // participants
      return { data: null, error: null }; // opportunities (なし)
    });

    const result: ApplyResult = await applyToOpportunity(
      "nonexistent",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("案件が見つかりません");
  });

  it("募集終了の案件にはエラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: { id: "user-123" }, error: null }; // participants
      return { data: { id: "opp-1", status: "closed" }, error: null }; // opportunities
    });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("この案件は募集を終了しています");
  });

  it("重複応募の場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    let callCount = 0;
    mockSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: { id: "user-123" }, error: null }; // participants
      if (callCount === 2)
        return { data: { id: "opp-1", status: "open" }, error: null }; // opportunities
      return { data: { id: "app-existing" }, error: null }; // applications (既存)
    });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("この案件にはすでに応募済みです");
  });

  it("予期しないエラー時もクラッシュせずエラーを返す", async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const result: ApplyResult = await applyToOpportunity(
      "opp-1",
      "メッセージ"
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

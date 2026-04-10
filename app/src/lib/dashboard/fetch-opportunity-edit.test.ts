import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OpportunityEditResult } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockSelectEq = vi.fn();
const mockSelectEq2 = vi.fn();
const mockSingle = vi.fn();

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
              mockSelectEq(...eqArgs);
              return {
                eq: (...eqArgs2: unknown[]) => {
                  mockSelectEq2(...eqArgs2);
                  return {
                    single: () => {
                      mockSingle();
                      return mockSingle();
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  }),
}));

// redirect のモック（import エラー回避のため）
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { fetchOpportunityForEdit } = await import("./actions");

describe("fetchOpportunityForEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、null とエラーメッセージを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("opp-1");

    expect(result.opportunity).toBeNull();
    expect(result.error).toBe("ログインが必要です");
  });

  it("自団体の案件を正常に取得できる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const mockData = {
      id: "opp-1",
      title: "環境保全ボランティア",
      description: "森林再生活動を行います",
      required_traits: { extraversion: 70, openness: 80 },
      status: "open",
    };
    mockSingle.mockReturnValue({ data: mockData, error: null });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("opp-1");

    expect(result.opportunity).not.toBeNull();
    expect(result.opportunity?.id).toBe("opp-1");
    expect(result.opportunity?.title).toBe("環境保全ボランティア");
    expect(result.opportunity?.description).toBe("森林再生活動を行います");
    expect(result.opportunity?.required_traits).toEqual({
      extraversion: 70,
      openness: 80,
    });
    expect(result.opportunity?.status).toBe("open");

    // Supabase クエリの検証
    expect(mockFrom).toHaveBeenCalledWith("opportunities");
    expect(mockSelectEq).toHaveBeenCalledWith("id", "opp-1");
    expect(mockSelectEq2).toHaveBeenCalledWith("organization_id", "org-123");
  });

  it("案件が存在しない場合、null を返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockSingle.mockReturnValue({
      data: null,
      error: { message: "Row not found" },
    });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("non-existent");

    expect(result.opportunity).toBeNull();
  });

  it("他団体の案件は取得できない（organization_id フィルタ）", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockSingle.mockReturnValue({
      data: null,
      error: { message: "Row not found" },
    });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("other-org-opp");

    expect(result.opportunity).toBeNull();
    // organization_id によるフィルタが適用されることを検証
    expect(mockSelectEq2).toHaveBeenCalledWith("organization_id", "org-123");
  });

  it("description が null の場合、空文字列に変換される", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const mockData = {
      id: "opp-2",
      title: "テスト案件",
      description: null,
      required_traits: null,
      status: "open",
    };
    mockSingle.mockReturnValue({ data: mockData, error: null });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("opp-2");

    expect(result.opportunity?.description).toBe("");
    expect(result.opportunity?.required_traits).toBeNull();
  });

  it("DB エラー時もクラッシュせずエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockSingle.mockImplementation(() => {
      throw new Error("DB connection error");
    });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("opp-1");

    expect(result.opportunity).toBeNull();
    expect(result.error).toBe("データの取得に失敗しました");
  });
});

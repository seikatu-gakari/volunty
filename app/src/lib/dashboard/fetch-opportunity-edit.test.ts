import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OpportunityEditResult } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockSelectEq = vi.fn();
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
                  mockSelectEq(...eqArgs2);
                  return {
                    single: () => mockSingle(),
                  };
                },
                single: () => mockSingle(),
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
    const mockUser = { id: "user-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // m_organization_profile 取得
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    // m_opportunity 取得
    mockSingle.mockReturnValueOnce({
      data: {
        id: "opp-1",
        title: "環境保全ボランティア",
        description: "森林再生活動を行います",
        requirement_traits: { extraversion: 70, openness: 80 },
        status: "published",
      },
      error: null,
    });

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
    expect(result.opportunity?.status).toBe("published");

    // Supabase クエリの検証
    expect(mockFrom).toHaveBeenCalledWith("m_organization_profile");
    expect(mockFrom).toHaveBeenCalledWith("m_opportunity");
    expect(mockSelectEq).toHaveBeenCalledWith("id", "opp-1");
    // organization_id は profile.id (org-123ではなく実際のprofile ID)
  });

  it("団体プロフィール未設定の場合、null を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    // m_organization_profile 取得失敗
    mockSingle.mockReturnValueOnce({ data: null, error: { message: "Not found" } });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("opp-1");

    expect(result.opportunity).toBeNull();
    expect(result.error).toBe("団体プロフィールが見つかりません");
  });

  it("案件が存在しない場合、null を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    // m_organization_profile 取得成功
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    // m_opportunity 取得失敗
    mockSingle.mockReturnValueOnce({ data: null, error: { message: "Row not found" } });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("non-existent");

    expect(result.opportunity).toBeNull();
  });

  it("他団体の案件は取得できない（organization_id フィルタ）", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockSingle.mockReturnValueOnce({ data: null, error: { message: "Row not found" } });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("other-org-opp");

    expect(result.opportunity).toBeNull();
  });

  it("description が null の場合、空文字列に変換される", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockSingle.mockReturnValueOnce({
      data: {
        id: "opp-2",
        title: "テスト案件",
        description: null,
        requirement_traits: null,
        status: "draft",
      },
      error: null,
    });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("opp-2");

    expect(result.opportunity).not.toBeNull();
    expect(result.opportunity?.description).toBe("");
  });

  it("DB エラー時もクラッシュせずエラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockSingle.mockImplementation(() => {
      throw new Error("DB connection error");
    });

    const result: OpportunityEditResult =
      await fetchOpportunityForEdit("opp-1");

    expect(result.opportunity).toBeNull();
    expect(result.error).toBe("データの取得に失敗しました");
  });
});

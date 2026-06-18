import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UpdateOpportunityResult } from "./types";

// Variable to store the final return value (error object)
let mockUpdateResult: { error: unknown } = { error: null };

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockSelectEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockUpdateEq2 = vi.fn((..._args: unknown[]) => mockUpdateResult);

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      mockFrom(table);
      if (table === "m_organization_profile") {
        return {
          select: (...args: unknown[]) => {
            mockSelect(...args);
            return {
              eq: (...eqArgs: unknown[]) => {
                mockSelectEq(...eqArgs);
                return {
                  single: () => mockSingle(),
                };
              },
            };
          },
        };
      } else if (table === "m_opportunity") {
        return {
          update: (data: unknown) => {
            mockUpdate(data);
            return {
              eq: (...args: unknown[]) => {
                mockUpdateEq(...args);
                return {
                  eq: (...args2: unknown[]) => {
                    mockUpdateEq2(...args2);
                    return mockUpdateEq2();
                  },
                };
              },
            };
          },
        };
      }
    },
  }),
}));

// redirect のモック
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
  },
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { updateOpportunity } = await import("./actions");

/** テスト用 FormData を生成するヘルパー */
function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

describe("updateOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateResult = { error: null };
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
    });

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      fd
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("ログインが必要です");
  });

  it("タイトルが空の場合、バリデーションエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const fd = buildFormData({ title: "", description: "テスト説明" });

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      fd
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("タイトルは必須です");
  });

  it("説明が空の場合、バリデーションエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const fd = buildFormData({ title: "テスト案件", description: "" });

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      fd
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("説明は必須です");
  });

  it("正常に案件を更新し、詳細ページへリダイレクトする", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    
    // 1回目: m_organization_profile を取得
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    // 2回目: m_opportunity を更新
    mockUpdateResult = { error: null };

    const fd = buildFormData({
      title: "更新された案件",
      description: "更新された説明",
      status: "closed",
    });

    await updateOpportunity("opp-1", fd);

    // Supabase クエリの検証
    expect(mockFrom).toHaveBeenCalledWith("m_organization_profile");
    expect(mockFrom).toHaveBeenCalledWith("m_opportunity");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "更新された案件",
        description: "更新された説明",
        status: "closed",
      })
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "opp-1");
    // organization_id は profile.id (org-123ではなく実際のprofile ID)

    // リダイレクトの検証
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard/opportunities/opp-1");
  });

  it("特性スコア付きで案件を更新できる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockUpdateResult = { error: null };

    const fd = buildFormData({
      title: "子ども支援イベント",
      description: "学習支援を行います",
      trait_extraversion: "70",
      trait_openness: "80",
    });

    await updateOpportunity("opp-1", fd);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "子ども支援イベント",
        requirement_traits: { extraversion: 70, openness: 80 },
      })
    );
  });

  it("追加項目（場所・日程・定員・カテゴリ・参加形態）を更新できる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockUpdateResult = { error: null };

    const fd = buildFormData({
      title: "更新された案件",
      description: "更新された説明",
      location: "新宿区",
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      capacity: "20",
      category: "教育",
      participationMode: "online",
    });

    await updateOpportunity("opp-1", fd);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        location: "新宿区",
        start_date: "2026-08-01",
        end_date: "2026-08-05",
        capacity: 20,
        category: "教育",
        participation_mode: "online",
      })
    );
  });

  it("終了日が開始日より前の場合、バリデーションエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
      startDate: "2026-08-05",
      endDate: "2026-08-01",
    });

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      fd
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("終了日は開始日以降の日付を指定してください");
  });

  it("ステータスが未指定の場合はステータスを更新しない", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockUpdateResult = { error: null };

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
    });

    await updateOpportunity("opp-1", fd);

    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty("status");
  });

  it("DB エラー時にエラーメッセージを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockUpdateResult = { error: { message: "DB error" } };

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
    });

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      fd
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("案件の更新に失敗しました");
  });

  it("予期しないエラー時もクラッシュせずエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    
    // Profile lookup throws unexpected error
    mockSingle.mockImplementationOnce(() => {
      throw new Error("Unexpected error");
    });
    mockUpdateEq2.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
    });

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      fd
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

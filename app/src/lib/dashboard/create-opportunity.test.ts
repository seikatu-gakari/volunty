import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreateOpportunityResult } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      mockFrom(table);
      return {
        insert: (data: unknown) => {
          mockInsert(data);
          return mockInsert(data);
        },
      };
    },
  }),
}));

// redirect のモック（呼ばれたことを検証するため）
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
  },
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { createOpportunity } = await import("./actions");

/** テスト用 FormData を生成するヘルパー */
function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

describe("createOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const result: CreateOpportunityResult = await createOpportunity(fd);

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

    const result: CreateOpportunityResult = await createOpportunity(fd);

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

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("説明は必須です");
  });

  it("正常に案件を作成し、/dashboard へリダイレクトする", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockInsert.mockReturnValue({ error: null });

    const fd = buildFormData({
      title: "環境保全ボランティア",
      description: "森林再生活動を行います",
    });

    await createOpportunity(fd);

    // Supabase クエリの検証
    expect(mockFrom).toHaveBeenCalledWith("opportunities");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-123",
        title: "環境保全ボランティア",
        description: "森林再生活動を行います",
        status: "open",
        required_traits: null,
      })
    );

    // リダイレクトの検証
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("特性スコア付きで案件を作成できる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockInsert.mockReturnValue({ error: null });

    const fd = buildFormData({
      title: "子ども支援イベント",
      description: "学習支援を行います",
      trait_extraversion: "70",
      trait_openness: "80",
    });

    await createOpportunity(fd);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-123",
        title: "子ども支援イベント",
        required_traits: { extraversion: 70, openness: 80 },
        status: "open",
      })
    );
  });

  it("不正な特性スコア（範囲外）は無視される", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockInsert.mockReturnValue({ error: null });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
      trait_extraversion: "150",
      trait_openness: "-10",
      trait_agreeableness: "abc",
      trait_conscientiousness: "60",
    });

    await createOpportunity(fd);

    // 不正な値は除外され、有効な値のみ含まれる
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        required_traits: { conscientiousness: 60 },
      })
    );
  });

  it("DB エラー時にエラーメッセージを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockInsert.mockReturnValue({ error: { message: "DB error" } });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
    });

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("案件の作成に失敗しました");
  });

  it("予期しないエラー時もクラッシュせずエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockInsert.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
    });

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CreateOpportunityResult } from "./types";

vi.mock("server-only", () => ({}));

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockSelectEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockInsertReturn = vi.fn();

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
          insert: (data: unknown) => {
            mockInsert(data);
            return mockInsertReturn();
          },
        };
      }
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
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
    
    // 1回目: m_organization_profile を取得
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    // 2回目: m_opportunity を挿入
    mockInsertReturn.mockReturnValueOnce({ error: null });

    const fd = buildFormData({
      title: "環境保全ボランティア",
      description: "森林再生活動を行います",
    });

    await createOpportunity(fd);

    // Supabase クエリの検証
    expect(mockFrom).toHaveBeenCalledWith("m_organization_profile");
    expect(mockFrom).toHaveBeenCalledWith("m_opportunity");
    // organization_idは profile UUID (org-123ではなく実際のprofile ID)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "環境保全ボランティア",
        description: "森林再生活動を行います",
        status: "published",
        activity_style_tags: null,
        required_qualifications: null,
        min_age: null,
        max_age: null,
      })
    );

    // リダイレクトの検証
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("下書きとして案件を作成できる", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "org-123", email: "org@example.com" } },
      error: null,
    });
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockInsertReturn.mockReturnValueOnce({ error: null });

    await createOpportunity(
      buildFormData({
        title: "下書き案件",
        description: "あとで公開します",
        publishMode: "draft",
      })
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        published_at: null,
      })
    );
  });

  it("公開予約日時を指定して案件を作成できる", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "org-123", email: "org@example.com" } },
      error: null,
    });
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockInsertReturn.mockReturnValueOnce({ error: null });

    await createOpportunity(
      buildFormData({
        title: "予約案件",
        description: "来週公開します",
        publishMode: "scheduled",
        publishedAt: "2026-08-01T10:00",
      })
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_at: "2026-08-01T01:00:00.000Z",
      })
    );
  });

  it("過去の公開予約日時では作成せず、フィールドエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "org-123", email: "org@example.com" } },
      error: null,
    });
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });

    const result: CreateOpportunityResult = await createOpportunity(
      buildFormData({
        title: "過去日時の案件",
        description: "作成されません",
        publishMode: "scheduled",
        publishedAt: "2026-06-30T10:00",
      })
    );

    expect(result).toEqual({
      success: false,
      error: "公開予約日時は現在より後の日時を指定してください",
      fieldErrors: {
        publishedAt: "公開予約日時は現在より後の日時を指定してください",
      },
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("Supabase REST経由の作成時に必須タイムスタンプを明示する", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "org-123", email: "org@example.com" } },
      error: null,
    });
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockInsertReturn.mockReturnValueOnce({ error: null });

    await createOpportunity(
      buildFormData({ title: "テスト案件", description: "テスト説明" })
    );

    const inserted = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.created_at).toEqual(expect.any(String));
    expect(inserted.updated_at).toBe(inserted.created_at);
    expect(inserted.published_at).toBe(inserted.created_at);
  });

  it("活動スタイルタグ・参加要件付きで案件を作成できる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockInsertReturn.mockReturnValueOnce({ error: null });

    const fd = buildFormData({
      title: "子ども支援イベント",
      description: "学習支援を行います",
      requiredQualifications: "普通自動車免許",
      minAge: "18",
    });
    fd.append("activityStyleTags", "empathy-support");
    fd.append("activityStyleTags", "creative-ideas");

    await createOpportunity(fd);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "子ども支援イベント",
        activity_style_tags: ["empathy-support", "creative-ideas"],
        required_qualifications: ["普通自動車免許"],
        min_age: 18,
        max_age: null,
        status: "published",
      })
    );
  });

  it("不正な活動スタイルタグはエラーになる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
    });
    fd.append("activityStyleTags", "unknown-tag");

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("活動スタイルタグの値が正しくありません");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("活動スタイルタグは4つ以上選べない", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
    });
    for (const tag of [
      "empathy-support",
      "creative-ideas",
      "talk-with-new-people",
      "solo-focused-work",
    ]) {
      fd.append("activityStyleTags", tag);
    }

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("活動スタイルタグは3つまで選択できます");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("年齢要件が不正な場合はエラーになる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
      minAge: "abc",
    });

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("年齢要件は0〜120の整数で入力してください");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("DB エラー時にエラーメッセージを返す", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    
    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockInsertReturn.mockReturnValueOnce({
      error: {
        code: "PGRST204",
        message: "schema cache error",
        details: "column is missing",
        hint: "reload schema",
      },
    });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
    });

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("案件の作成に失敗しました");
    expect(consoleError).toHaveBeenCalledWith(
      "[createOpportunity] INSERT failed",
      {
        code: "PGRST204",
        message: "schema cache error",
        details: "column is missing",
        hint: "reload schema",
      }
    );
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: expect.anything() })
    );
    consoleError.mockRestore();
  });

  it("追加項目（場所・日程・定員・カテゴリ・参加形態）を保存できる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockInsertReturn.mockReturnValueOnce({ error: null });

    const fd = buildFormData({
      title: "環境保全ボランティア",
      description: "森林再生活動を行います",
      location: "渋谷区",
      startDate: "2026-07-01",
      endDate: "2026-07-10",
      capacity: "10",
      category: "環境保全",
      participationMode: "offline",
    });

    await createOpportunity(fd);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        location: "渋谷区",
        start_date: "2026-07-01",
        end_date: "2026-07-10",
        capacity: 10,
        category: "環境保全",
        participation_mode: "offline",
      })
    );
  });

  it("追加項目が未入力の場合は null で保存される", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle.mockReturnValueOnce({ data: { id: "profile-123" }, error: null });
    mockInsertReturn.mockReturnValueOnce({ error: null });

    const fd = buildFormData({ title: "テスト案件", description: "テスト説明" });

    await createOpportunity(fd);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        location: null,
        start_date: null,
        end_date: null,
        capacity: null,
        category: null,
        participation_mode: null,
      })
    );
  });

  it("終了日が開始日より前の場合、バリデーションエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
      startDate: "2026-07-10",
      endDate: "2026-07-01",
    });

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("終了日は開始日以降の日付を指定してください");
  });

  it("定員が0以下の場合、バリデーションエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
      capacity: "0",
    });

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("定員は1以上の整数で入力してください");
  });

  it("不正なカテゴリの場合、バリデーションエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
      category: "存在しないカテゴリ",
    });

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("カテゴリの値が正しくありません");
  });

  it("不正な参加形態の場合、バリデーションエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    const fd = buildFormData({
      title: "テスト案件",
      description: "テスト説明",
      participationMode: "invalid",
    });

    const result: CreateOpportunityResult = await createOpportunity(fd);

    expect(result.success).toBe(false);
    expect(result.error).toBe("参加形態の値が正しくありません");
  });

  it("予期しないエラー時もクラッシュせずエラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    
    mockSingle.mockImplementationOnce(() => {
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

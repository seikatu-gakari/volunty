import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateOpportunityResult } from "./types";

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-09-06T03:00:00.000Z");

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockSelectEq = vi.fn();
const mockProfileSingle = vi.fn();
const mockOpportunitySingle = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockUpdateOrganizationEq = vi.fn();
const mockUpdateStatusEq = vi.fn();
const mockUpdatePublishedAtEq = vi.fn();
const mockUpdateIs = vi.fn();
const mockUpdateSelect = vi.fn();
let mockUpdateResult: { data: unknown[] | null; error: unknown } = {
  data: [{ id: "opp-1" }],
  error: null,
};

function updateFilters() {
  return {
    eq: (...args: unknown[]) => {
      mockUpdatePublishedAtEq(...args);
      return {
        select: (...selectArgs: unknown[]) => {
          mockUpdateSelect(...selectArgs);
          return mockUpdateResult;
        },
      };
    },
    is: (...args: unknown[]) => {
      mockUpdateIs(...args);
      return {
        select: (...selectArgs: unknown[]) => {
          mockUpdateSelect(...selectArgs);
          return mockUpdateResult;
        },
      };
    },
  };
}

function updateQuery() {
  return {
    eq: (...args: unknown[]) => {
      mockUpdateEq(...args);
      return {
        eq: (...organizationArgs: unknown[]) => {
          mockUpdateOrganizationEq(...organizationArgs);
          return {
            eq: (...statusArgs: unknown[]) => {
              mockUpdateStatusEq(...statusArgs);
              return updateFilters();
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
      if (table === "m_organization_profile") {
        return {
          select: (...args: unknown[]) => {
            mockSelect(...args);
            return {
              eq: (...eqArgs: unknown[]) => {
                mockSelectEq(...eqArgs);
                return { single: () => mockProfileSingle() };
              },
            };
          },
        };
      }
      if (table === "m_opportunity") {
        return {
          select: (...args: unknown[]) => {
            mockSelect(...args);
            return {
              eq: (...eqArgs: unknown[]) => {
                mockSelectEq(...eqArgs);
                return {
                  eq: (...eqArgs2: unknown[]) => {
                    mockSelectEq(...eqArgs2);
                    return { single: () => mockOpportunitySingle() };
                  },
                };
              },
            };
          },
          update: (data: unknown) => {
            mockUpdate(data);
            return updateQuery();
          },
        };
      }
      return undefined;
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

const { updateOpportunity } = await import("./actions");

/** テスト用 FormData を生成するヘルパー */
function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

function setAuthenticatedUser() {
  mockGetUser.mockReturnValue({
    data: { user: { id: "org-user-1", email: "org@example.com" } },
    error: null,
  });
}

function setCurrentOpportunity(
  status: "draft" | "published" | "closed",
  publishedAt: string | null,
) {
  mockOpportunitySingle.mockReturnValue({
    data: { status, published_at: publishedAt },
    error: null,
  });
}

function setReadyForUpdate(
  status: "draft" | "published" | "closed" = "draft",
  publishedAt: string | null = null,
) {
  setAuthenticatedUser();
  mockProfileSingle.mockReturnValue({
    data: { id: "profile-123" },
    error: null,
  });
  setCurrentOpportunity(status, publishedAt);
}

function validFields(fields: Record<string, string> = {}) {
  return buildFormData({
    title: "テスト案件",
    description: "テスト説明",
    ...fields,
  });
}

describe("updateOpportunity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    mockProfileSingle.mockReset();
    mockOpportunitySingle.mockReset();
    mockUpdateResult = { data: [{ id: "opp-1" }], error: null };
    setReadyForUpdate();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      validFields(),
    );

    expect(result).toEqual({ success: false, error: "ログインが必要です" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("タイトルが空の場合、バリデーションエラーを返す", async () => {
    setAuthenticatedUser();

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      validFields({ title: "" }),
    );

    expect(result).toEqual({ success: false, error: "タイトルは必須です" });
    expect(mockProfileSingle).not.toHaveBeenCalled();
  });

  it("説明が空の場合、バリデーションエラーを返す", async () => {
    setAuthenticatedUser();

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      validFields({ description: "" }),
    );

    expect(result).toEqual({ success: false, error: "説明は必須です" });
    expect(mockProfileSingle).not.toHaveBeenCalled();
  });

  it("活動スタイルタグ・参加要件付きで案件を更新できる", async () => {
    const formData = validFields({ maxAge: "65" });
    formData.append("activityStyleTags", "empathy-support");
    formData.set("requiredQualifications", "普通自動車免許");

    await updateOpportunity("opp-1", formData);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        activity_style_tags: ["empathy-support"],
        required_qualifications: ["普通自動車免許"],
        max_age: 65,
      }),
    );
  });

  it("追加項目（場所・日程・定員・カテゴリ・参加形態）を更新できる", async () => {
    await updateOpportunity(
      "opp-1",
      validFields({
        location: "新宿区",
        startDate: "2026-08-01",
        endDate: "2026-08-05",
        capacity: "20",
        category: "教育",
        participationMode: "online",
      }),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        location: "新宿区",
        start_date: "2026-08-01",
        end_date: "2026-08-05",
        capacity: 20,
        category: "教育",
        participation_mode: "online",
      }),
    );
  });

  it("終了日が開始日より前の場合、バリデーションエラーを返す", async () => {
    const result = await updateOpportunity(
      "opp-1",
      validFields({ startDate: "2026-08-05", endDate: "2026-08-01" }),
    );

    expect(result).toEqual({
      success: false,
      error: "終了日は開始日以降の日付を指定してください",
    });
    expect(mockProfileSingle).not.toHaveBeenCalled();
  });

  it("下書きから募集中へ変更すると status と固定時刻の公開日時を同一更新する", async () => {
    setReadyForUpdate("draft", null);

    await updateOpportunity("opp-1", validFields({ status: "published" }));

    expect(mockSelect).toHaveBeenCalledWith("status, published_at");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_at: NOW.toISOString(),
      }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "opp-1");
    expect(mockUpdateOrganizationEq).toHaveBeenCalledWith(
      "organization_id",
      "profile-123",
    );
    expect(mockUpdateStatusEq).toHaveBeenCalledWith("status", "draft");
    expect(mockUpdateIs).toHaveBeenCalledWith("published_at", null);
    expect(mockUpdateSelect).toHaveBeenCalledWith("id");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/dashboard/opportunities/opp-1",
    );
  });

  it("公開中の内容編集では公開日時を維持する", async () => {
    const publishedAt = "2026-08-01T00:00:00.000Z";
    setReadyForUpdate("published", publishedAt);

    await updateOpportunity("opp-1", validFields({ status: "published" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_at: publishedAt,
      }),
    );
    expect(mockUpdatePublishedAtEq).toHaveBeenCalledWith(
      "published_at",
      publishedAt,
    );
  });

  it("公開予約中の内容編集では予約日時を維持する", async () => {
    const publishedAt = "2026-09-10T00:00:00.000Z";
    setReadyForUpdate("published", publishedAt);

    await updateOpportunity("opp-1", validFields({ status: "published" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_at: publishedAt,
      }),
    );
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ published_at: NOW.toISOString() }),
    );
  });

  it("公開日時NULLの既存不整合を募集中で明示保存すると公開日時を補完する", async () => {
    setReadyForUpdate("published", null);

    await updateOpportunity("opp-1", validFields({ status: "published" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_at: NOW.toISOString(),
      }),
    );
    expect(mockUpdateIs).toHaveBeenCalledWith("published_at", null);
  });

  it("募集終了から募集中へ変更すると以前の日時を復元せず再公開する", async () => {
    setReadyForUpdate("closed", "2026-09-10T00:00:00.000Z");

    await updateOpportunity("opp-1", validFields({ status: "published" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_at: NOW.toISOString(),
      }),
    );
  });

  it("下書き化すると公開日時をNULLにする", async () => {
    setReadyForUpdate("published", "2026-08-01T00:00:00.000Z");

    await updateOpportunity("opp-1", validFields({ status: "draft" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft", published_at: null }),
    );
  });

  it("予約案件を募集終了にすると予約日時を維持する", async () => {
    const publishedAt = "2026-09-10T00:00:00.000Z";
    setReadyForUpdate("published", publishedAt);

    await updateOpportunity("opp-1", validFields({ status: "closed" }));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "closed", published_at: publishedAt }),
    );
  });

  it("status と publishMode がともに省略された場合は公開状態を更新しない", async () => {
    const publishedAt = "2026-08-01T00:00:00.000Z";
    setReadyForUpdate("published", publishedAt);

    await updateOpportunity("opp-1", validFields());

    const updateArg = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty("status");
    expect(updateArg).not.toHaveProperty("published_at");
    expect(mockUpdateStatusEq).toHaveBeenCalledWith("status", "published");
    expect(mockUpdatePublishedAtEq).toHaveBeenCalledWith(
      "published_at",
      publishedAt,
    );
  });

  it("publishMode の明示操作を status と公開日時へ反映する", async () => {
    setReadyForUpdate("draft", null);

    await updateOpportunity(
      "opp-1",
      validFields({ publishMode: "published" }),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_at: NOW.toISOString(),
      }),
    );
  });

  it("publishMode=scheduled は検証済みの日時を保存する", async () => {
    setReadyForUpdate("draft", null);

    await updateOpportunity(
      "opp-1",
      validFields({
        status: "published",
        publishMode: "scheduled",
        publishedAt: "2026-09-10T10:00",
      }),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_at: "2026-09-10T01:00:00.000Z",
      }),
    );
  });

  it("publishMode と status の不一致は保存しない", async () => {
    setReadyForUpdate("draft", null);

    const result = await updateOpportunity(
      "opp-1",
      validFields({ status: "closed", publishMode: "published" }),
    );

    expect(result).toEqual({
      success: false,
      error: "案件ステータスと公開方法の指定が一致しません",
    });
    expect(mockProfileSingle).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("status の未知の値は保存しない", async () => {
    setReadyForUpdate("draft", null);

    const result = await updateOpportunity(
      "opp-1",
      validFields({ status: "unknown" }),
    );

    expect(result).toEqual({
      success: false,
      error: "案件ステータスの値が正しくありません",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("publishMode の未知の値は保存しない", async () => {
    setReadyForUpdate("draft", null);

    const result = await updateOpportunity(
      "opp-1",
      validFields({ publishMode: "unknown" }),
    );

    expect(result).toEqual({
      success: false,
      error: "公開方法の値が正しくありません",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("団体プロフィールに紐づかない案件は見つからない扱いにして更新しない", async () => {
    setReadyForUpdate("draft", null);
    mockOpportunitySingle.mockReturnValue({
      data: null,
      error: { code: "PGRST116", message: "No rows found" },
    });

    const result = await updateOpportunity("other-opp", validFields());

    expect(result).toEqual({ success: false, error: "案件が見つかりません" });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("案件の状態取得でDBエラーが発生した場合は更新しない", async () => {
    setReadyForUpdate("draft", null);
    mockOpportunitySingle.mockReturnValue({
      data: null,
      error: { code: "PGRST500", message: "database error" },
    });

    const result = await updateOpportunity("opp-1", validFields());

    expect(result).toEqual({
      success: false,
      error: "案件の更新に失敗しました",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("更新結果が0件の場合は競合エラーを返してリダイレクトしない", async () => {
    setReadyForUpdate("draft", null);
    mockUpdateResult = { data: [], error: null };

    const result = await updateOpportunity("opp-1", validFields());

    expect(result).toEqual({
      success: false,
      error: "公開状態が変更されています。画面を再読み込みしてから保存してください",
    });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("更新結果がNULLの場合も成功扱いにしない", async () => {
    setReadyForUpdate("draft", null);
    mockUpdateResult = { data: null, error: null };

    const result = await updateOpportunity("opp-1", validFields());

    expect(result.success).toBe(false);
    expect(result.error).toContain("公開状態が変更されています");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("DB更新エラー時はリダイレクトしない", async () => {
    setReadyForUpdate("draft", null);
    mockUpdateResult = { data: null, error: { message: "DB error" } };

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      validFields(),
    );

    expect(result).toEqual({
      success: false,
      error: "案件の更新に失敗しました",
    });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("プロフィール取得の予期しないエラー時もクラッシュしない", async () => {
    setAuthenticatedUser();
    mockProfileSingle.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const result: UpdateOpportunityResult = await updateOpportunity(
      "opp-1",
      validFields(),
    );

    expect(result).toEqual({
      success: false,
      error: "予期しないエラーが発生しました",
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

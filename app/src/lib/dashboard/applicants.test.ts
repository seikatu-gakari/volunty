import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApplicantsResult, UpdateApplicationStatusResult } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockIn = vi.fn();

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
                single: () => mockSingle(),
                eq: (...eq2Args: unknown[]) => {
                  mockEq(...eq2Args);
                  return {
                    single: () => mockSingle(),
                  };
                },
                order: (...orderArgs: unknown[]) => {
                  mockOrder(...orderArgs);
                  return mockOrder();
                },
              };
            },
            in: (...inArgs: unknown[]) => {
              mockIn(...inArgs);
              return mockIn();
            },
            order: (...orderArgs: unknown[]) => {
              mockOrder(...orderArgs);
              return mockOrder();
            },
          };
        },
        update: (data: unknown) => {
          mockUpdate(data);
          return {
            eq: (...eqArgs: unknown[]) => {
              mockUpdateEq(...eqArgs);
              return mockUpdateEq();
            },
          };
        },
        in: (...inArgs: unknown[]) => {
          mockIn(...inArgs);
          return mockIn();
        },
      };
    },
  }),
}));

// redirect のモック
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// matching のモック
vi.mock("@/lib/recommendations/matching", () => ({
  calculateMatchScore: vi.fn().mockReturnValue(75),
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { fetchApplicantsForOpportunity, updateApplicationStatus } = await import(
  "./actions"
);

describe("fetchApplicantsForOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("ログインが必要です");
  });

  it("団体プロフィール未設定の場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockReturnValue({
      data: null,
      error: { message: "Not found" },
    });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("団体プロフィールが見つかりません");
  });

  it("自団体の案件でない場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    // m_organization_profile 取得成功
    mockSingle
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      // m_opportunity 取得失敗
      .mockReturnValueOnce({ data: null, error: { message: "Not found" } });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-999");

    expect(result.data).toBeNull();
    expect(result.error).toBe("案件が見つかりません");
  });

  it("応募者がいる場合、応募者一覧を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    // m_organization_profile 取得
    mockSingle
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      // m_opportunity 取得
      .mockReturnValueOnce({
        data: {
          id: "opp-1",
          title: "環境保全ボランティア",
          description: "テスト説明",
          status: "published",
          requirement_traits: { extraversion: 70 },
          created_at: "2026-01-15T00:00:00Z",
        },
        error: null,
      });

    // t_matching_candidate 取得
    mockOrder.mockReturnValue({
      data: [
        {
          id: "app-1",
          status: "applied",
          message: "応募メッセージ",
          match_score: 75.5,
          applied_at: "2026-01-20T00:00:00Z",
          participant_id: "user-participant-1",
        },
      ],
      error: null,
    });

    // m_participant_profile 取得
    mockIn.mockReturnValue({
      data: [
        {
          user_id: "user-participant-1",
          name: "テスト太郎",
          diagnosis_type: "イノベーター・リーダー",
          diagnosis_scores: {
            extraversion: 80,
            agreeableness: 60,
            conscientiousness: 70,
            neuroticism: 30,
            openness: 90,
          },
        },
      ],
      error: null,
    });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).not.toBeNull();
    expect(result.data!.id).toBe("opp-1");
    expect(result.data!.title).toBe("環境保全ボランティア");
    expect(result.data!.applicants).toHaveLength(1);

    const applicant = result.data!.applicants[0];
    expect(applicant.id).toBe("app-1");
    expect(applicant.participant_name).toBe("テスト太郎");
    expect(applicant.diagnosis_type).toBe("イノベーター・リーダー");
    expect(applicant.status).toBe("pending"); // DB: applied → UI: pending
    expect(applicant.match_score).toBe(75.5);
  });

  it("応募者が0件の場合、空配列を返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({
        data: {
          id: "opp-1",
          title: "テスト案件",
          description: null,
          status: "published",
          requirement_traits: null,
          created_at: "2026-01-15T00:00:00Z",
        },
        error: null,
      });

    mockOrder.mockReturnValue({ data: [], error: null });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).not.toBeNull();
    expect(result.data!.applicants).toEqual([]);
  });

  it("DB エラー時もクラッシュせずエラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockImplementation(() => {
      throw new Error("DB connection error");
    });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

describe("updateApplicationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "approved");

    expect(result.success).toBe(false);
    expect(result.error).toBe("ログインが必要です");
  });

  it("応募が見つからない場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockReturnValue({
      data: null,
      error: { message: "Not found" },
    });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-999", "approved");

    expect(result.success).toBe(false);
    expect(result.error).toBe("応募が見つかりません");
  });

  it("団体プロフィール未設定の場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    // t_matching_candidate 取得成功
    mockSingle
      .mockReturnValueOnce({
        data: { id: "app-1", opportunity_id: "opp-1" },
        error: null,
      })
      // m_organization_profile 取得失敗
      .mockReturnValueOnce({ data: null, error: { message: "Not found" } });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "approved");

    expect(result.success).toBe(false);
    expect(result.error).toBe("団体プロフィールが見つかりません");
  });

  it("自団体の案件でない場合、権限エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: { id: "app-1", opportunity_id: "opp-1" },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({
        data: null,
        error: null,
      });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "approved");

    expect(result.success).toBe(false);
    expect(result.error).toBe("この操作を行う権限がありません");
  });

  it("正常に承認ステータスに更新できる", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: { id: "app-1", opportunity_id: "opp-1" },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({ data: { id: "opp-1" }, error: null });

    mockUpdateEq.mockReturnValue({ error: null });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "approved");

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ status: "accepted" }); // UI: approved → DB: accepted
    expect(mockFrom).toHaveBeenCalledWith("t_matching_candidate");
  });

  it("正常に辞退ステータスに更新できる", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: { id: "app-1", opportunity_id: "opp-1" },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({ data: { id: "opp-1" }, error: null });

    mockUpdateEq.mockReturnValue({ error: null });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "rejected");

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ status: "declined" }); // UI: rejected → DB: declined
  });

  it("DB エラー時もクラッシュせずエラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockImplementation(() => {
      throw new Error("DB connection error");
    });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "approved");

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});


describe("fetchApplicantsForOpportunity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("ログインが必要です");
  });

  it("自団体の案件でない場合、エラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockSingle.mockReturnValue({ data: null, error: { message: "Not found" } });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-999");

    expect(result.data).toBeNull();
    expect(result.error).toBe("案件が見つかりません");
  });

  it("応募者がいる場合、応募者一覧を返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // 案件データ
    mockSingle.mockReturnValue({
      data: {
        id: "opp-1",
        title: "環境保全ボランティア",
        description: "テスト説明",
        status: "published",
        requirement_traits: { extraversion: 70 },
        created_at: "2026-01-15T00:00:00Z",
      },
      error: null,
    });

    // 応募者データ（t_matching_candidate のみ、participants は別クエリ）
    mockOrder.mockReturnValueOnce({
      data: [
        {
          id: "app-1",
          participant_id: "user-participant-1",
          status: "applied",
          match_score: 75,
          message: "応募メッセージ",
          created_at: "2026-01-20T00:00:00Z",
        },
      ],
      error: null,
    });

    // 参加者プロフィール（m_participant_profile）
    mockIn.mockReturnValueOnce({
      data: [
        {
          user_id: "user-participant-1",
          name: "テスト太郎",
          diagnosis_type: "イノベーター・リーダー",
          diagnosis_scores: {
            extraversion: 80,
            agreeableness: 60,
            conscientiousness: 70,
            neuroticism: 30,
            openness: 90,
          },
        },
      ],
      error: null,
    });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).not.toBeNull();
    expect(result.data!.id).toBe("opp-1");
    expect(result.data!.title).toBe("環境保全ボランティア");
    expect(result.data!.applicants).toHaveLength(1);

    const applicant = result.data!.applicants[0];
    expect(applicant.id).toBe("app-1");
    expect(applicant.participant_name).toBe("テスト太郎");
    expect(applicant.diagnosis_type).toBe("イノベーター・リーダー");
    expect(applicant.match_score).toBe(75); // モックの戻り値
  });

  it("応募者が0件の場合、空配列を返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    mockSingle.mockReturnValue({
      data: {
        id: "opp-1",
        title: "テスト案件",
        description: null,
        status: "published",
        requirement_traits: null,
        created_at: "2026-01-15T00:00:00Z",
      },
      error: null,
    });

    mockOrder.mockReturnValue({ data: [] });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).not.toBeNull();
    expect(result.data!.applicants).toEqual([]);
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

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

describe("updateApplicationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "approved");

    expect(result.success).toBe(false);
    expect(result.error).toBe("ログインが必要です");
  });

  it("応募が見つからない場合、エラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });
    mockSingle.mockReturnValue({
      data: null,
      error: { message: "Not found" },
    });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-999", "approved");

    expect(result.success).toBe(false);
    expect(result.error).toBe("応募が見つかりません");
  });

  it("自団体の案件でない場合、権限エラーを返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // 1回目: 応募データの取得 → 成功
    // 2回目: 案件の認可チェック → 失敗
    mockSingle
      .mockReturnValueOnce({
        data: { id: "app-1", opportunity_id: "opp-1" },
        error: null,
      })
      .mockReturnValueOnce({
        data: null,
        error: null,
      });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "approved");

    expect(result.success).toBe(false);
    expect(result.error).toBe("この操作を行う権限がありません");
  });

  it("正常に承認ステータスに更新できる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // 応募データ取得
    mockSingle
      .mockReturnValueOnce({
        data: { id: "app-1", opportunity_id: "opp-1" },
        error: null,
      })
      // 案件の認可チェック
      .mockReturnValueOnce({
        data: { id: "opp-1" },
        error: null,
      });

    // ステータス更新
    mockUpdateEq.mockReturnValue({ error: null });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "approved");

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ status: "approved" });
    expect(mockFrom).toHaveBeenCalledWith("applications");
  });

  it("正常に辞退ステータスに更新できる", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    mockSingle
      .mockReturnValueOnce({
        data: { id: "app-1", opportunity_id: "opp-1" },
        error: null,
      })
      .mockReturnValueOnce({
        data: { id: "opp-1" },
        error: null,
      });

    mockUpdateEq.mockReturnValue({ error: null });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "rejected");

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ status: "rejected" });
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

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "approved");

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

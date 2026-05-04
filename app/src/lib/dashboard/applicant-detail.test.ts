import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApplicantDetailResult } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
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
              mockEq(...eqArgs);
              return {
                eq: (...eq2Args: unknown[]) => {
                  mockEq(...eq2Args);
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

// redirect のモック
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// matching のモック
vi.mock("@/lib/recommendations/matching", () => ({
  calculateMatchScore: vi.fn().mockReturnValue(75),
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { fetchApplicantDetail } = await import("./actions");

describe("fetchApplicantDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("ログインが必要です");
  });

  it("応募が見つからない場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockReturnValue({
      data: null,
      error: { message: "Not found" },
    });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-999");

    expect(result.data).toBeNull();
    expect(result.error).toBe("応募が見つかりません");
  });

  it("団体プロフィール未設定の場合、エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: {
          id: "app-1",
          status: "applied",
          message: "テストメッセージ",
          applied_at: "2026-01-20T00:00:00Z",
          opportunity_id: "opp-1",
          participant_id: "user-participant-1",
        },
        error: null,
      })
      .mockReturnValueOnce({ data: null, error: { message: "Not found" } });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("団体プロフィールが見つかりません");
  });

  it("自団体の案件でない場合、権限エラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: {
          id: "app-1",
          status: "applied",
          message: "テストメッセージ",
          applied_at: "2026-01-20T00:00:00Z",
          opportunity_id: "opp-1",
          participant_id: "user-participant-1",
        },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({ data: null, error: { message: "Not found" } });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("この操作を行う権限がありません");
  });

  it("正常に応募者詳細を返す（診断タイプあり）", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: {
          id: "app-1",
          status: "applied",
          message: "応募メッセージです",
          applied_at: "2026-01-20T00:00:00Z",
          opportunity_id: "opp-1",
          participant_id: "user-participant-1",
          match_score: 82.5,
        },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({
        data: {
          id: "opp-1",
          title: "環境保全ボランティア",
          requirement_traits: { extraversion: 70 },
        },
        error: null,
      })
      .mockReturnValueOnce({
        data: {
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
        error: null,
      });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-1");

    expect(result.data).not.toBeNull();
    expect(result.data!.id).toBe("app-1");
    expect(result.data!.participant_name).toBe("テスト太郎");
    expect(result.data!.diagnosis_type).toBe("イノベーター・リーダー");
    expect(result.data!.status).toBe("pending"); // DB: applied → UI: pending
    expect(result.data!.message).toBe("応募メッセージです");
    expect(result.data!.created_at).toBe("2026-01-20T00:00:00Z");
    expect(result.data!.opportunity_id).toBe("opp-1");
    expect(result.data!.opportunity_title).toBe("環境保全ボランティア");
    expect(result.data!.match_score).toBe(82.5);

    // PERSONALITY_TYPES からの詳細が引き当てられている
    expect(result.data!.personality_type_detail).not.toBeNull();
    expect(result.data!.personality_type_detail!.name).toBe(
      "イノベーター・リーダー"
    );
  });

  it("診断未実施の応募者でも正常に返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: {
          id: "app-2",
          status: "applied",
          message: null,
          applied_at: "2026-01-20T00:00:00Z",
          opportunity_id: "opp-1",
          participant_id: "user-participant-1",
          match_score: null,
        },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({
        data: {
          id: "opp-1",
          title: "テスト案件",
          requirement_traits: null,
        },
        error: null,
      })
      .mockReturnValueOnce({
        data: {
          name: "未診断ユーザー",
          diagnosis_type: null,
          diagnosis_scores: null,
        },
        error: null,
      });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-2");

    expect(result.data).not.toBeNull();
    expect(result.data!.participant_name).toBe("未診断ユーザー");
    expect(result.data!.diagnosis_type).toBeNull();
    expect(result.data!.diagnosis_scores).toBeNull();
    expect(result.data!.match_score).toBeNull();
    expect(result.data!.personality_type_detail).toBeNull();
  });

  it("DB エラー時もクラッシュせずエラーを返す", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockImplementation(() => {
      throw new Error("DB connection error");
    });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});


describe("fetchApplicantDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
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

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-999");

    expect(result.data).toBeNull();
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
        data: {
          id: "app-1",
          status: "applied",
          message: "テストメッセージ",
          created_at: "2026-01-20T00:00:00Z",
          participant_id: "user-participant-1",
          match_score: 85,
        },
        error: null,
      })
              conscientiousness: 70,
              neuroticism: 30,
              openness: 90,
            },
          },
        },
        error: null,
      })
      .mockReturnValueOnce({
        data: null,
        error: { message: "Not found" },
      });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("この操作を行う権限がありません");
  });

  it("正常に応募者詳細を返す（診断タイプあり）", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    // 1回目: t_matching_candidate データ（応募）
    mockSingle
      .mockReturnValueOnce({
        data: {
          id: "app-1",
          status: "applied",
          message: "応募メッセージです",
          applied_at: "2026-01-20T00:00:00Z",
          opportunity_id: "opp-1",
          participant_id: "user-participant-1",
          match_score: 85,
        },
        error: null,
      })
      // 2回目: m_organization_profile（認可チェック）
      .mockReturnValueOnce({
        data: { id: "profile-123" },
        error: null,
      })
      // 3回目: m_opportunity（認可チェック）
      .mockReturnValueOnce({
        data: {
          id: "opp-1",
          title: "環境保全ボランティア",
          requirement_traits: { extraversion: 70 },
        },
        error: null,
      })
      // 4回目: m_participant_profile（参加者情報）
      .mockReturnValueOnce({
        data: {
          name: "テスト太郎",
          diagnosis_type: "イノベーター・リーダータイプ",
          diagnosis_scores: {
            extraversion: 80,
            agreeableness: 60,
            conscientiousness: 70,
            neuroticism: 30,
            openness: 90,
          },
        },
        error: null,
      });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-1");

    expect(result.data).not.toBeNull();
    expect(result.data!.id).toBe("app-1");
    expect(result.data!.participant_name).toBe("テスト太郎");
    expect(result.data!.diagnosis_type).toBe("イノベーター・リーダータイプ");
    expect(result.data!.message).toBe("応募メッセージです");
    expect(result.data!.opportunity_id).toBe("opp-1");
    expect(result.data!.opportunity_title).toBe("環境保全ボランティア");
    expect(result.data!.match_score).toBe(75); // モックの戻り値

    // PERSONALITY_TYPES からの詳細が引き当てられている
    expect(result.data!.personality_type_detail).not.toBeNull();
    expect(result.data!.personality_type_detail!.name).toBe(
      "イノベーター・リーダータイプ"
    );
    expect(result.data!.personality_type_detail!.description).toBe(
      "新しいアイデアを積極的に提案し、チームを牽引する"
    );
    expect(result.data!.personality_type_detail!.strengths).toContain(
      "プロジェクトリーダー"
    );
    expect(
      result.data!.personality_type_detail!.suitableActivities
    ).toContain("イベント統括");
  });

  it("診断未実施の応募者でも正常に返す", async () => {
    const mockUser = { id: "org-123", email: "org@example.com" };
    mockGetUser.mockReturnValue({
      data: { user: mockUser },
      error: null,
    });

    mockSingle
      .mockReturnValueOnce({
        data: {
          id: "app-2",
          status: "applied",
          message: null,
          applied_at: "2026-01-20T00:00:00Z",
          opportunity_id: "opp-1",
          participant_id: "user-participant-2",
          match_score: null,
        },
        error: null,
      })
      .mockReturnValueOnce({
        data: { id: "profile-123" },
        error: null,
      })
      .mockReturnValueOnce({
        data: {
          id: "opp-1",
          title: "テスト案件",
          requirement_traits: null,
        },
        error: null,
      })
      .mockReturnValueOnce({
        data: {
          name: "未診断ユーザー",
          diagnosis_type: null,
          diagnosis_scores: null,
        },
        error: null,
      });

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-2");

    expect(result.data).not.toBeNull();
    expect(result.data!.participant_name).toBe("未診断ユーザー");
    expect(result.data!.diagnosis_type).toBeNull();
    expect(result.data!.diagnosis_scores).toBeNull();
    expect(result.data!.match_score).toBeNull();
    expect(result.data!.personality_type_detail).toBeNull();
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

    const result: ApplicantDetailResult =
      await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

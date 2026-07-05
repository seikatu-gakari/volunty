import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ApplicantDetailResult } from "./types";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();

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
                    maybeSingle: () => mockMaybeSingle(),
                  };
                },
                single: () => mockSingle(),
                maybeSingle: () => mockMaybeSingle(),
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

    const result: ApplicantDetailResult = await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("ログインが必要です");
  });

  it("応募が見つからない場合、エラーを返す", async () => {
    const mockUser = { id: "org-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockReturnValue({
      data: null,
      error: { message: "Not found" },
    });

    const result: ApplicantDetailResult = await fetchApplicantDetail("app-999");

    expect(result.data).toBeNull();
    expect(result.error).toBe("応募が見つかりません");
  });

  it("団体プロフィール未設定の場合、エラーを返す", async () => {
    const mockUser = { id: "org-123" };
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

    const result: ApplicantDetailResult = await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("団体プロフィールが見つかりません");
  });

  it("自団体の案件でない場合、権限エラーを返す", async () => {
    const mockUser = { id: "org-123" };
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

    const result: ApplicantDetailResult = await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("この操作を行う権限がありません");
  });

  it("正常に応募者詳細を返す（診断済み: 参考タイプのみ開示し、生スコアは含めない）", async () => {
    const mockUser = { id: "org-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      // 1回目: t_matching_candidate
      .mockReturnValueOnce({
        data: {
          id: "app-1",
          status: "applied",
          message: "応募メッセージです",
          applied_at: "2026-01-20T00:00:00Z",
          opportunity_id: "opp-1",
          participant_id: "user-participant-1",
        },
        error: null,
      })
      // 2回目: m_organization_profile（認可チェック）
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      // 3回目: m_opportunity（認可チェック）
      .mockReturnValueOnce({
        data: { id: "opp-1", title: "環境保全ボランティア" },
        error: null,
      })
      // 4回目: m_participant_profile
      .mockReturnValueOnce({
        data: {
          name: "テスト太郎",
          latest_diagnosis_result_id: "diag-1",
        },
        error: null,
      });
    // t_diagnosis_result（参考タイプIDのみ）
    mockMaybeSingle.mockReturnValueOnce({
      data: { style_type_id: "supporter-care" },
      error: null,
    });

    const result: ApplicantDetailResult = await fetchApplicantDetail("app-1");

    expect(result.data).not.toBeNull();
    expect(result.data!.id).toBe("app-1");
    expect(result.data!.participant_name).toBe("テスト太郎");
    expect(result.data!.status).toBe("pending"); // DB: applied → UI: pending
    expect(result.data!.message).toBe("応募メッセージです");
    expect(result.data!.opportunity_id).toBe("opp-1");
    expect(result.data!.opportunity_title).toBe("環境保全ボランティア");
    expect(result.data!.style_type_label).toBe("サポーター・ケアタイプ");
    expect(result.data!.style_type_detail).not.toBeNull();
    expect(result.data!.style_type_detail!.name).toBe("サポーター・ケアタイプ");
    // 生の診断スコア・旧マッチングスコアは団体へ開示しない
    expect(result.data).not.toHaveProperty("diagnosis_scores");
    expect(result.data).not.toHaveProperty("match_score");
  });

  it("診断未実施の応募者でも正常に返す", async () => {
    const mockUser = { id: "org-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: {
          id: "app-2",
          status: "applied",
          message: null,
          applied_at: "2026-01-20T00:00:00Z",
          opportunity_id: "opp-1",
          participant_id: "user-participant-2",
        },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({
        data: { id: "opp-1", title: "テスト案件" },
        error: null,
      })
      .mockReturnValueOnce({
        data: { name: "未診断ユーザー", latest_diagnosis_result_id: null },
        error: null,
      });

    const result: ApplicantDetailResult = await fetchApplicantDetail("app-2");

    expect(result.data).not.toBeNull();
    expect(result.data!.participant_name).toBe("未診断ユーザー");
    expect(result.data!.style_type_label).toBeNull();
    expect(result.data!.style_type_detail).toBeNull();
  });

  it("DB エラー時もクラッシュせずエラーを返す", async () => {
    const mockUser = { id: "org-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });
    mockSingle.mockImplementation(() => {
      throw new Error("DB connection error");
    });

    const result: ApplicantDetailResult = await fetchApplicantDetail("app-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ApplicantsResult,
  BulkCompleteApplicationsResult,
  UpdateApplicationStatusResult,
} from "./types";

vi.mock("server-only", () => ({}));

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
const mockFindOrganization = vi.fn();
const mockFindApplications = vi.fn();
const mockUpdateManyApplications = vi.fn();
const mockFindParticipants = vi.fn();


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
                  return mockOrder(...orderArgs);
                },
              };
            },
            in: (...inArgs: unknown[]) => {
              return mockIn(...inArgs);
            },
            order: (...orderArgs: unknown[]) => {
              return mockOrder(...orderArgs);
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
          return mockIn(...inArgs);
        },
      };
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockFindParticipants(...args),
    },
    organizationProfile: {
      findUnique: (...args: unknown[]) => mockFindOrganization(...args),
    },
    matchingCandidate: {
      findMany: (...args: unknown[]) => mockFindApplications(...args),
      updateMany: (...args: unknown[]) => mockUpdateManyApplications(...args),
    },
  },
}));

// redirect のモック
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const {
  bulkCompleteApplications,
  fetchApplicantsForOpportunity,
  updateApplicationStatus,
} = await import("./actions");


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
    mockSingle
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({ data: null, error: { message: "Not found" } });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("案件が見つかりません");
  });

  it("応募者一覧を参考タイプ名付きで返す（生スコアと旧マッチングスコアは含めない）", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({
        data: {
          id: "opp-1",
          title: "環境保全ボランティア",
          description: "説明",
          status: "published",
          created_at: "2026-01-15T00:00:00Z",
        },
        error: null,
      });

    // t_matching_candidate（applied_at 降順）
    mockOrder.mockReturnValueOnce({
      data: [
        {
          id: "app-1",
          status: "applied",
          message: "よろしくお願いします",
          applied_at: "2026-01-20T00:00:00Z",
          status_changed_at: "2026-01-20T00:00:00Z",
          participant_id: "user-participant-1",
        },
      ],
      error: null,
    });

    mockFindParticipants.mockResolvedValueOnce([
      {
        id: "user-participant-1",
        name: null,
        participantProfile: {
          name: "テスト太郎",
          latestDiagnosisResult: { styleTypeId: "supporter-care" },
        },
      },
    ]);

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data).not.toBeNull();
    expect(result.data!.id).toBe("opp-1");
    expect(result.data!.title).toBe("環境保全ボランティア");
    expect(result.data!.applicants).toHaveLength(1);

    const applicant = result.data!.applicants[0];
    expect(applicant.id).toBe("app-1");
    expect(applicant.participant_name).toBe("テスト太郎");
    expect(applicant.style_type_label).toBe("サポーター・ケアタイプ");
    expect(applicant.status).toBe("pending"); // DB: applied → UI: pending
    expect(applicant).not.toHaveProperty("diagnosis_scores");
    expect(applicant).not.toHaveProperty("match_score");
  });

  it("団体ユーザーでも応募者名と参考タイプを取得できる", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "organization-user" } },
      error: null,
    });
    mockSingle
      .mockReturnValueOnce({ data: { id: "organization-profile" }, error: null })
      .mockReturnValueOnce({
        data: {
          id: "opp-1",
          title: "テスト案件",
          description: null,
          status: "published",
          created_at: "2026-07-14T16:05:00.000",
        },
        error: null,
      });
    mockOrder.mockReturnValueOnce({
      data: [
        {
          id: "app-1",
          status: "applied",
          message: null,
          applied_at: "2026-07-14T16:10:00.000",
          status_changed_at: "2026-07-14T16:10:00.000",
          participant_id: "participant-user",
        },
      ],
      error: null,
    });
    mockFindParticipants.mockResolvedValueOnce([
      {
        id: "participant-user",
        name: "ユーザー名",
        participantProfile: {
          name: "手動検証参加者",
          latestDiagnosisResult: { styleTypeId: "supporter-care" },
        },
      },
    ]);

    const result = await fetchApplicantsForOpportunity("opp-1");

    expect(result.data?.applicants[0]).toMatchObject({
      participant_name: "手動検証参加者",
      style_type_label: "サポーター・ケアタイプ",
    });
  });

  it("未診断の応募者は style_type_label が null になる", async () => {
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
          created_at: "2026-01-15T00:00:00Z",
        },
        error: null,
      });

    mockOrder.mockReturnValueOnce({
      data: [
        {
          id: "app-2",
          status: "applied",
          message: null,
          applied_at: "2026-01-21T00:00:00Z",
          status_changed_at: "2026-01-21T00:00:00Z",
          participant_id: "user-participant-2",
        },
      ],
      error: null,
    });

    mockFindParticipants.mockResolvedValueOnce([
      {
        id: "user-participant-2",
        name: null,
        participantProfile: {
          name: "未診断ユーザー",
          latestDiagnosisResult: null,
        },
      },
    ]);

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data!.applicants[0].style_type_label).toBeNull();
  });

  it("応募者は応募日の降順でソートされる", async () => {
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
          created_at: "2026-01-15T00:00:00Z",
        },
        error: null,
      });

    mockOrder.mockReturnValueOnce({
      data: [
        {
          id: "app-old",
          status: "applied",
          message: null,
          applied_at: "2026-01-10T00:00:00Z",
          status_changed_at: "2026-01-10T00:00:00Z",
          participant_id: "p1",
        },
        {
          id: "app-new",
          status: "applied",
          message: null,
          applied_at: "2026-01-25T00:00:00Z",
          status_changed_at: "2026-01-25T00:00:00Z",
          participant_id: "p2",
        },
      ],
      error: null,
    });

    mockFindParticipants.mockResolvedValueOnce([
      { id: "p1", name: "旧応募者", participantProfile: null },
      { id: "p2", name: "新応募者", participantProfile: null },
    ]);

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

    expect(result.data!.applicants.map((a) => a.id)).toEqual([
      "app-new",
      "app-old",
    ]);
  });

  it("未対応のみで絞り込める", async () => {
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
          created_at: "2026-01-15T00:00:00Z",
        },
        error: null,
      });

    mockOrder.mockReturnValueOnce({
      data: [
        {
          id: "app-pending",
          status: "applied",
          message: null,
          applied_at: "2026-01-10T00:00:00Z",
          status_changed_at: "2026-01-10T00:00:00Z",
          participant_id: "p1",
        },
        {
          id: "app-approved",
          status: "accepted",
          message: null,
          applied_at: "2026-01-11T00:00:00Z",
          status_changed_at: "2026-01-11T00:00:00Z",
          participant_id: "p2",
        },
      ],
      error: null,
    });

    mockFindParticipants.mockResolvedValueOnce([
      { id: "p1", name: "未対応", participantProfile: null },
      { id: "p2", name: "承認済み", participantProfile: null },
    ]);

    const result = await fetchApplicantsForOpportunity("opp-1", {
      status: "pending",
    });

    expect(result.data!.applicants.map((a) => a.id)).toEqual(["app-pending"]);
  });

  it("応募日昇順で並び替えられる", async () => {
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
          created_at: "2026-01-15T00:00:00Z",
        },
        error: null,
      });
    mockOrder.mockReturnValueOnce({
      data: [
        {
          id: "app-new",
          status: "applied",
          message: null,
          applied_at: "2026-01-25T00:00:00Z",
          status_changed_at: "2026-01-25T00:00:00Z",
          participant_id: "p2",
        },
        {
          id: "app-old",
          status: "applied",
          message: null,
          applied_at: "2026-01-10T00:00:00Z",
          status_changed_at: "2026-01-10T00:00:00Z",
          participant_id: "p1",
        },
      ],
      error: null,
    });
    mockFindParticipants.mockResolvedValueOnce([
      { id: "p1", name: "旧応募者", participantProfile: null },
      { id: "p2", name: "新応募者", participantProfile: null },
    ]);

    const result = await fetchApplicantsForOpportunity("opp-1", {
      sort: "applied_asc",
    });

    expect(result.data!.applicants.map((a) => a.id)).toEqual([
      "app-old",
      "app-new",
    ]);
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
          created_at: "2026-01-15T00:00:00Z",
        },
        error: null,
      });

    mockOrder.mockReturnValueOnce({ data: [], error: null });

    const result: ApplicantsResult =
      await fetchApplicantsForOpportunity("opp-1");

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

describe("bulkCompleteApplications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "org-user-1" } }, error: null });
    mockFindOrganization.mockResolvedValue({
      id: "org-profile-1",
      reviewStatus: "approved",
      user: { role: "organization" },
    });
  });

  it("空選択の場合はエラーを返す", async () => {
    const result: BulkCompleteApplicationsResult =
      await bulkCompleteApplications("opp-1", []);

    expect(result).toEqual({
      success: false,
      completedCount: 0,
      failedCount: 0,
      error: "活動完了にする応募を選択してください",
    });
    expect(mockUpdateManyApplications).not.toHaveBeenCalled();
  });

  it("自団体案件の承認済み応募だけを一括完了する", async () => {
    mockFindApplications.mockResolvedValue([
      { id: "app-1" },
      { id: "app-2" },
    ]);
    mockUpdateManyApplications.mockResolvedValue({ count: 2 });

    const result = await bulkCompleteApplications("opp-1", [
      "app-1",
      "app-2",
      "app-declined",
    ]);

    expect(result).toEqual({
      success: true,
      completedCount: 2,
      failedCount: 1,
    });
    expect(mockFindApplications).toHaveBeenCalledWith({
      where: {
        id: { in: ["app-1", "app-2", "app-declined"] },
        opportunityId: "opp-1",
        status: "accepted",
        opportunity: { organizationId: "org-profile-1" },
      },
      select: { id: true },
    });
    expect(mockUpdateManyApplications).toHaveBeenCalledWith({
      where: { id: { in: ["app-1", "app-2"] } },
      data: {
        status: "completed",
        statusChangedAt: expect.any(Date),
      },
    });
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
        data: { id: "app-1", opportunity_id: "opp-1", status: "applied" },
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
        data: { id: "app-1", opportunity_id: "opp-1", status: "applied" },
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
        data: { id: "app-1", opportunity_id: "opp-1", status: "applied" },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({ data: { id: "opp-1" }, error: null });

    mockUpdateEq.mockReturnValue({ error: null });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "approved");

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "accepted",
      status_changed_at: expect.any(String),
      updated_at: expect.any(String),
    }); // UI: approved → DB: accepted
    expect(mockFrom).toHaveBeenCalledWith("t_matching_candidate");
  });

  it("正常に辞退ステータスに更新できる", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: { id: "app-1", opportunity_id: "opp-1", status: "applied" },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({ data: { id: "opp-1" }, error: null });

    mockUpdateEq.mockReturnValue({ error: null });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "rejected");

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "declined",
      status_changed_at: expect.any(String),
      updated_at: expect.any(String),
    }); // UI: rejected → DB: declined
  });

  it("承認済み応募を活動完了に更新できる", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: { id: "app-1", opportunity_id: "opp-1", status: "accepted" },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({ data: { id: "opp-1" }, error: null });

    mockUpdateEq.mockReturnValue({ error: null });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "completed");

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "completed",
      status_changed_at: expect.any(String),
      updated_at: expect.any(String),
    });
  });

  it("承認済み以外の応募は活動完了に更新できない", async () => {
    const mockUser = { id: "user-123" };
    mockGetUser.mockReturnValue({ data: { user: mockUser }, error: null });

    mockSingle
      .mockReturnValueOnce({
        data: { id: "app-1", opportunity_id: "opp-1", status: "applied" },
        error: null,
      })
      .mockReturnValueOnce({ data: { id: "profile-123" }, error: null })
      .mockReturnValueOnce({ data: { id: "opp-1" }, error: null });

    const result: UpdateApplicationStatusResult =
      await updateApplicationStatus("app-1", "completed");

    expect(result.success).toBe(false);
    expect(result.error).toBe("承認済みの応募のみ活動完了にできます");
    expect(mockUpdate).not.toHaveBeenCalled();
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

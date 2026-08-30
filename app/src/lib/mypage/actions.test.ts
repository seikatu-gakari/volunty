import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyPageData } from "./types";

vi.mock("server-only", () => ({}));

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockFetchParticipantProfileByUserIdWithDebug = vi.fn();
const mockDeleteManyUser = vi.fn();
const mockDeleteAuthUser = vi.fn();
const mockFindFirstMatchingCandidate = vi.fn();
const mockRedirect = vi.fn();
const mockProcessAccountDeletion = vi.fn();
let mockAccountDeletionEnabled = true;

type MatchingRow = {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  applied_at: string | null;
  status_changed_at: string;
  opportunity_id: string;
};

type OpportunityRow = {
  id: string;
  title: string;
  m_organization_profile:
    | { organization_name: string; contact_line_id: string | null }
    | Array<{ organization_name: string; contact_line_id: string | null }>
    | null;
};

let mockMatchingRows: MatchingRow[] = [];
let mockOpportunityRows: OpportunityRow[] = [];
let mockMatchingError: Error | null = null;

vi.mock("@/lib/participant-profile/server", () => ({
  fetchParticipantProfileByUserIdWithDebug: (...args: unknown[]) =>
    mockFetchParticipantProfileByUserIdWithDebug(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      mockFrom(table);
      const query = {
        select: (...args: unknown[]) => {
          mockSelect(...args);
          return query;
        },
        eq: () => query,
        in: () => {
          if (table === "t_matching_candidate") {
            return query;
          }
          if (table === "m_opportunity") {
            return Promise.resolve({ data: mockOpportunityRows, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        order: () => {
          if (mockMatchingError) {
            throw mockMatchingError;
          }
          return Promise.resolve({
            data: mockMatchingRows.map((row) => ({
              ...row,
              m_opportunity: mockOpportunityRows.find(
                (opportunity) => opportunity.id === row.opportunity_id
              ) ?? null,
            })),
            error: null,
          });
        },
      };
      return query;
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => mockDeleteAuthUser(...args),
      },
    },
  })),
}));

vi.mock("@/lib/account-deletion/config", () => ({
  isAccountDeletionEnabled: () => mockAccountDeletionEnabled,
}));

vi.mock("@/lib/account-deletion/orchestrator", () => ({
  processAccountDeletion: (...args: unknown[]) => mockProcessAccountDeletion(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      deleteMany: (...args: unknown[]) => mockDeleteManyUser(...args),
    },
    matchingCandidate: {
      findFirst: (...args: unknown[]) => mockFindFirstMatchingCandidate(...args),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

const { deleteMyAccount } = await import("./actions");
const { fetchMyPageData } = await import("./queries");

function createDeleteFormData(confirmation: string) {
  const formData = new FormData();
  formData.set("confirmation", confirmation);
  return formData;
}

describe("fetchMyPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchingRows = [];
    mockOpportunityRows = [];
    mockMatchingError = null;
    mockFindFirstMatchingCandidate.mockResolvedValue(null);
    mockDeleteManyUser.mockResolvedValue({ count: 1 });
    mockDeleteAuthUser.mockResolvedValue({ data: { user: null }, error: null });
    mockProcessAccountDeletion.mockResolvedValue({ status: "completed" });
    mockAccountDeletionEnabled = true;
  });

  it("未認証の場合、空のデータを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: MyPageData = await fetchMyPageData("user-123");

    expect(result.profile).toBeNull();
    expect(result.applications).toEqual([]);
  });

  it("認証済みでプロフィールがある場合、プロフィール情報を返す", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockFetchParticipantProfileByUserIdWithDebug.mockResolvedValue({
      profile: {
        id: "user-123",
        name: "テストユーザー",
        region: "東京都",
        latestDiagnosis: {
          styleTypeId: "innovator-leader",
          answeredAt: new Date("2026-07-01T00:00:00Z"),
        },
      },
      debug: {
        fallbackUsed: false,
        prismaErrorDetail: null,
        supabaseErrorDetail: null,
      },
    });

    const result: MyPageData = await fetchMyPageData("user-123");

    expect(result.profile).toEqual({
      id: "user-123",
      name: "テストユーザー",
      region: "東京都",
      diagnosis_completed: true,
      diagnosis_style_type_label: "イノベーター・リーダータイプ",
      diagnosis_answered_at: "2026-07-01T00:00:00.000Z",
    });
    expect(result.alert).toBeNull();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("検証済み userId を使い、プロフィールと応募取得を並列に開始する", async () => {
    let resolveProfile: ((value: unknown) => void) | undefined;
    mockGetUser.mockReturnValue({ data: { user: { id: "wrong-user" } } });
    mockFetchParticipantProfileByUserIdWithDebug.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve;
        })
    );

    const resultPromise = fetchMyPageData("verified-user");
    await vi.waitFor(() =>
      expect(mockFrom).toHaveBeenCalledWith("t_matching_candidate")
    );

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFetchParticipantProfileByUserIdWithDebug).toHaveBeenCalledWith(
      "verified-user"
    );
    expect(
      mockFrom.mock.calls.filter(([table]) => table === "t_matching_candidate")
    ).toHaveLength(1);
    expect(mockSelect).toHaveBeenCalledWith(
      expect.stringContaining("m_opportunity(id, title")
    );
    expect(mockSelect).toHaveBeenCalledWith(
      expect.stringContaining(
        "m_organization_profile(organization_name, contact_line_id)"
      )
    );

    resolveProfile?.({
      profile: null,
      debug: {
        fallbackUsed: false,
        prismaErrorDetail: null,
        supabaseErrorDetail: null,
      },
    });
    await resultPromise;
  });

  it("応募データがある場合、応募一覧を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockFetchParticipantProfileByUserIdWithDebug.mockResolvedValue({
      profile: null,
      debug: {
        fallbackUsed: false,
        prismaErrorDetail: null,
        supabaseErrorDetail: null,
      },
    });
    mockMatchingRows = [
      {
        id: "app-1",
        status: "applied",
        message: "応募メッセージ",
        created_at: "2026-01-01T00:00:00.000Z",
        applied_at: "2026-01-01T00:00:00.000Z",
        status_changed_at: "2026-01-01T00:00:00.000Z",
        opportunity_id: "opp-1",
      },
      {
        id: "app-2",
        status: "accepted",
        message: null,
        created_at: "2026-01-02T00:00:00.000Z",
        applied_at: "2026-01-02T00:00:00.000Z",
        status_changed_at: "2026-01-02T00:00:00.000Z",
        opportunity_id: "opp-2",
      },
    ];
    mockOpportunityRows = [
      {
        id: "opp-1",
        title: "環境保全ボランティア",
        m_organization_profile: {
          organization_name: "NPO法人テスト",
          contact_line_id: "@test_line",
        },
      },
      {
        id: "opp-2",
        title: "子ども支援活動",
        m_organization_profile: {
          organization_name: "支援団体A",
          contact_line_id: "@support_line",
        },
      },
    ];

    const result: MyPageData = await fetchMyPageData("user-123");

    expect(result.applications).toHaveLength(2);

    const pendingApp = result.applications[1];
    expect(pendingApp.status).toBe("pending");
    expect(pendingApp.completed_at).toBeNull();
    expect(pendingApp.can_request_certificate).toBe(false);
    expect(pendingApp.opportunity.title).toBe("環境保全ボランティア");
    expect(pendingApp.opportunity.organization_name).toBe("NPO法人テスト");
    expect(pendingApp.opportunity.organization_line_id).toBeNull();

    const approvedApp = result.applications[0];
    expect(approvedApp.status).toBe("approved");
    expect(approvedApp.completed_at).toBeNull();
    expect(approvedApp.can_request_certificate).toBe(false);
    expect(approvedApp.opportunity.title).toBe("子ども支援活動");
    expect(approvedApp.opportunity.organization_name).toBe("支援団体A");
    expect(approvedApp.opportunity.organization_line_id).toBe("@support_line");
  });

  it("rejected の場合、LINE ID を返さない", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockFetchParticipantProfileByUserIdWithDebug.mockResolvedValue({
      profile: null,
      debug: {
        fallbackUsed: false,
        prismaErrorDetail: null,
        supabaseErrorDetail: null,
      },
    });
    mockMatchingRows = [
      {
        id: "app-3",
        status: "declined",
        message: null,
        created_at: "2026-01-03T00:00:00.000Z",
        applied_at: "2026-01-03T00:00:00.000Z",
        status_changed_at: "2026-01-03T00:00:00.000Z",
        opportunity_id: "opp-3",
      },
      {
        id: "app-4",
        status: "completed",
        message: null,
        created_at: "2026-01-04T00:00:00.000Z",
        applied_at: "2026-01-04T00:00:00.000Z",
        status_changed_at: "2026-02-10T12:34:00.000Z",
        opportunity_id: "opp-4",
      },
    ];
    mockOpportunityRows = [
      {
        id: "opp-3",
        title: "イベントスタッフ",
        m_organization_profile: {
          organization_name: "イベント団体",
          contact_line_id: "@event_line",
        },
      },
      {
        id: "opp-4",
        title: "配布物作成サポート",
        m_organization_profile: {
          organization_name: "制作団体",
          contact_line_id: "@production_line",
        },
      },
    ];

    const result: MyPageData = await fetchMyPageData("user-123");

    const rejectedApp = result.applications[1];
    expect(rejectedApp.status).toBe("rejected");
    expect(rejectedApp.completed_at).toBeNull();
    expect(rejectedApp.can_request_certificate).toBe(false);
    expect(rejectedApp.opportunity.organization_line_id).toBeNull();

    const completedApp = result.applications[0];
    expect(completedApp.status).toBe("completed");
    expect(completedApp.completed_at).toBe("2026-02-10T12:34:00.000Z");
    expect(completedApp.can_request_certificate).toBe(true);
    expect(completedApp.opportunity.organization_line_id).toBe(
      "@production_line"
    );
  });

  it("DB エラー時もクラッシュせず空データを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockFetchParticipantProfileByUserIdWithDebug.mockResolvedValue({
      profile: null,
      debug: {
        fallbackUsed: false,
        prismaErrorDetail: null,
        supabaseErrorDetail: null,
      },
    });
    mockMatchingError = new Error("DB connection error");

    const result: MyPageData = await fetchMyPageData("user-123");

    expect(result.profile).toBeNull();
    expect(result.applications).toEqual([]);
  });
});

describe("fetchMyApplicationDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirstMatchingCandidate.mockResolvedValue(null);
  });

  it("未認証の場合、error を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const { fetchMyApplicationDetail } = await import("./actions");
    const result = await fetchMyApplicationDetail("app-1");

    expect(result.application).toBeNull();
    expect(result.error).toBe("ログインが必要です");
  });

  it("応募が見つからない場合、application が null でエラーなし", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-1" } }, error: null });
    mockFindFirstMatchingCandidate.mockResolvedValue(null);

    const { fetchMyApplicationDetail } = await import("./actions");
    const result = await fetchMyApplicationDetail("unknown-id");

    expect(mockFindFirstMatchingCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "unknown-id",
          participantId: "user-1",
          status: { in: ["applied", "accepted", "completed", "declined"] },
        }),
      })
    );
    expect(result.application).toBeNull();
    expect(result.error).toBeNull();
  });

  it("pending ステータスの場合、LINE ID は null を返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-1" } }, error: null });
    mockFindFirstMatchingCandidate.mockResolvedValue({
      id: "app-1",
      status: "applied",
      message: "志望動機です",
      appliedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      statusChangedAt: new Date("2026-01-01T00:00:00.000Z"),
      opportunity: {
        id: "opp-1",
        title: "環境保全活動",
        description: "説明テキスト",
        location: "東京都",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-31"),
        category: "環境保全",
        participationMode: "offline",
        organization: {
          organizationName: "NPO法人テスト",
          contactLineId: "@test_line",
        },
      },
    });

    const { fetchMyApplicationDetail } = await import("./actions");
    const result = await fetchMyApplicationDetail("app-1");

    expect(result.application).not.toBeNull();
    expect(result.application?.status).toBe("pending");
    expect(result.application?.message).toBe("志望動機です");
    expect(result.application?.opportunity.organization_line_id).toBeNull();
    expect(result.application?.can_request_certificate).toBe(false);
  });

  it("approved ステータスの場合、LINE ID を返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-1" } }, error: null });
    mockFindFirstMatchingCandidate.mockResolvedValue({
      id: "app-2",
      status: "accepted",
      message: null,
      appliedAt: new Date("2026-02-01T00:00:00.000Z"),
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      statusChangedAt: new Date("2026-02-05T00:00:00.000Z"),
      opportunity: {
        id: "opp-2",
        title: "子ども支援",
        description: null,
        location: null,
        startDate: null,
        endDate: null,
        category: null,
        participationMode: null,
        organization: {
          organizationName: "支援団体A",
          contactLineId: "@line_a",
        },
      },
    });

    const { fetchMyApplicationDetail } = await import("./actions");
    const result = await fetchMyApplicationDetail("app-2");

    expect(result.application?.status).toBe("approved");
    expect(result.application?.opportunity.organization_line_id).toBe("@line_a");
  });

  it("マッチング成立時は organization_line_url を返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-1" } }, error: null });
    mockFindFirstMatchingCandidate.mockResolvedValue({
      id: "app-4",
      status: "accepted",
      message: null,
      appliedAt: new Date("2026-02-01T00:00:00.000Z"),
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      statusChangedAt: new Date("2026-02-05T00:00:00.000Z"),
      opportunity: {
        id: "opp-4",
        title: "子ども支援",
        description: null,
        location: null,
        startDate: null,
        endDate: null,
        category: null,
        participationMode: null,
        organization: {
          organizationName: "支援団体A",
          contactLineId: "@line_a",
          contactLineUrl: "https://line.me/R/ti/p/@line_a",
        },
      },
    });

    const { fetchMyApplicationDetail } = await import("./actions");
    const result = await fetchMyApplicationDetail("app-4");

    expect(result.application?.opportunity.organization_line_url).toBe(
      "https://line.me/R/ti/p/@line_a"
    );
  });

  it("審査中は organization_line_url を秘匿する", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-1" } }, error: null });
    mockFindFirstMatchingCandidate.mockResolvedValue({
      id: "app-5",
      status: "applied",
      message: null,
      appliedAt: new Date("2026-02-01T00:00:00.000Z"),
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      statusChangedAt: new Date("2026-02-01T00:00:00.000Z"),
      opportunity: {
        id: "opp-5",
        title: "子ども支援",
        description: null,
        location: null,
        startDate: null,
        endDate: null,
        category: null,
        participationMode: null,
        organization: {
          organizationName: "支援団体A",
          contactLineId: "@line_a",
          contactLineUrl: "https://line.me/R/ti/p/@line_a",
        },
      },
    });

    const { fetchMyApplicationDetail } = await import("./actions");
    const result = await fetchMyApplicationDetail("app-5");

    expect(result.application?.opportunity.organization_line_url).toBeNull();
  });

  it("completed ステータスの場合、証明書申請可能フラグと完了日を返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-1" } }, error: null });
    const completedAt = new Date("2026-03-10T12:00:00.000Z");
    mockFindFirstMatchingCandidate.mockResolvedValue({
      id: "app-3",
      status: "completed",
      message: null,
      appliedAt: new Date("2026-01-15T00:00:00.000Z"),
      createdAt: new Date("2026-01-15T00:00:00.000Z"),
      statusChangedAt: completedAt,
      opportunity: {
        id: "opp-3",
        title: "清掃活動",
        description: null,
        location: null,
        startDate: null,
        endDate: null,
        category: null,
        participationMode: null,
        organization: {
          organizationName: "地域団体",
          contactLineId: "@local",
        },
      },
    });

    const { fetchMyApplicationDetail } = await import("./actions");
    const result = await fetchMyApplicationDetail("app-3");

    expect(result.application?.status).toBe("completed");
    expect(result.application?.completed_at).toBe("2026-03-10T12:00:00.000Z");
    expect(result.application?.can_request_certificate).toBe(true);
  });

  it("DB エラー時、エラーメッセージを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-1" } }, error: null });
    mockFindFirstMatchingCandidate.mockRejectedValue(new Error("DB error"));

    const { fetchMyApplicationDetail } = await import("./actions");
    const result = await fetchMyApplicationDetail("app-1");

    expect(result.application).toBeNull();
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

describe("deleteMyAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountDeletionEnabled = true;
    mockProcessAccountDeletion.mockResolvedValue({ status: "completed" });
    mockDeleteManyUser.mockResolvedValue({ count: 1 });
    mockDeleteAuthUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("確認語句が一致しない場合、削除せずエラーを返す", async () => {
    const result = await deleteMyAccount(
      { error: null },
      createDeleteFormData("削除")
    );

    expect(result).toEqual({
      error: "確認欄に「削除する」と入力してください。",
    });
    expect(mockProcessAccountDeletion).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("未認証の場合、削除せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result = await deleteMyAccount(
      { error: null },
      createDeleteFormData("削除する")
    );

    expect(result).toEqual({
      error: "ログイン状態を確認できませんでした。再ログインしてからお試しください。",
    });
    expect(mockProcessAccountDeletion).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("認証済みの場合、削除 saga を実行してログイン画面へ遷移する", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    await deleteMyAccount({ error: null }, createDeleteFormData("削除する"));

    expect(mockProcessAccountDeletion).toHaveBeenCalledWith("user-123");
    expect(mockRedirect).toHaveBeenCalledWith("/login?accountDeleted=1");
  });

  it("台帳作成に失敗した場合、開始失敗エラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockProcessAccountDeletion.mockRejectedValue(new Error("DB error"));

    const result = await deleteMyAccount(
      { error: null },
      createDeleteFormData("削除する")
    );

    expect(result).toEqual({
      error: "アカウント削除に失敗しました。時間をおいて再度お試しください。",
    });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("Auth ユーザー削除に失敗した場合、再試行できるエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockProcessAccountDeletion.mockResolvedValue({ status: "auth_failed" });

    const result = await deleteMyAccount(
      { error: null },
      createDeleteFormData("削除する")
    );

    expect(result).toEqual({
      error:
        "認証アカウントの削除に失敗しました。時間をおいて再度お試しください。",
    });
    expect(mockProcessAccountDeletion).toHaveBeenCalledWith("user-123");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("cleanup 保留時は完了と区別したログイン画面へ遷移する", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } }, error: null });
    mockProcessAccountDeletion.mockResolvedValue({ status: "cleanup_pending" });

    await deleteMyAccount({ error: null }, createDeleteFormData("削除する"));

    expect(mockRedirect).toHaveBeenCalledWith("/login?accountDeletionPending=1");
  });

  it("kill switch 無効時は認証・削除副作用を開始しない", async () => {
    mockAccountDeletionEnabled = false;

    await expect(
      deleteMyAccount({ error: null }, createDeleteFormData("削除する"))
    ).resolves.toEqual({ error: "現在、アカウント削除を一時停止しています。" });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockProcessAccountDeletion).not.toHaveBeenCalled();
  });
});

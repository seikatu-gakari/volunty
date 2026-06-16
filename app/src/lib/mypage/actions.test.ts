import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyPageData } from "./types";

const mockGetUser = vi.fn();
const mockFetchParticipantProfileByUserIdWithDebug = vi.fn();
const mockDeleteManyUser = vi.fn();
const mockDeleteAuthUser = vi.fn();
const mockRedirect = vi.fn();

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
      const query = {
        select: () => query,
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
          return Promise.resolve({ data: mockMatchingRows, error: null });
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      deleteMany: (...args: unknown[]) => mockDeleteManyUser(...args),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

const { deleteMyAccount, fetchMyPageData } = await import("./actions");

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
    mockDeleteManyUser.mockResolvedValue({ count: 1 });
    mockDeleteAuthUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("未認証の場合、空のデータを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const result: MyPageData = await fetchMyPageData();

    expect(result.profile).toBeNull();
    expect(result.applications).toEqual([]);
  });

  it("認証済みでプロフィールがある場合、プロフィール情報を返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockFetchParticipantProfileByUserIdWithDebug.mockResolvedValue({
      profile: {
        id: "user-123",
        name: "テストユーザー",
        region: "東京都",
        diagnosisType: "イノベーター・リーダー",
        diagnosisScores: { extraversion: 85, agreeableness: 70 },
      },
      debug: {
        fallbackUsed: false,
        prismaErrorDetail: null,
        supabaseErrorDetail: null,
      },
    });

    const result: MyPageData = await fetchMyPageData();

    expect(result.profile).toEqual({
      id: "user-123",
      name: "テストユーザー",
      region: "東京都",
      diagnosis_type: "イノベーター・リーダー",
      diagnosis_scores: { extraversion: 85, agreeableness: 70 },
      diagnosis_updated_at: null,
    });
    expect(result.alert).toBeNull();
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

    const result: MyPageData = await fetchMyPageData();

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

    const result: MyPageData = await fetchMyPageData();

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

    const result: MyPageData = await fetchMyPageData();

    expect(result.profile).toBeNull();
    expect(result.applications).toEqual([]);
  });
});

describe("deleteMyAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(mockDeleteManyUser).not.toHaveBeenCalled();
    expect(mockDeleteAuthUser).not.toHaveBeenCalled();
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
    expect(mockDeleteManyUser).not.toHaveBeenCalled();
    expect(mockDeleteAuthUser).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("認証済みの場合、m_user と Supabase Auth ユーザーを物理削除してログイン画面へ遷移する", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    await deleteMyAccount({ error: null }, createDeleteFormData("削除する"));

    expect(mockDeleteManyUser).toHaveBeenCalledWith({
      where: { id: "user-123" },
    });
    expect(mockDeleteAuthUser).toHaveBeenCalledWith("user-123", false);
    expect(mockRedirect).toHaveBeenCalledWith("/login?accountDeleted=1");
  });

  it("DB 削除に失敗した場合、Auth ユーザーを削除せずエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockDeleteManyUser.mockRejectedValue(new Error("DB error"));

    const result = await deleteMyAccount(
      { error: null },
      createDeleteFormData("削除する")
    );

    expect(result).toEqual({
      error: "アカウント削除に失敗しました。時間をおいて再度お試しください。",
    });
    expect(mockDeleteAuthUser).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("Auth ユーザー削除に失敗した場合、再試行できるエラーを返す", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    mockDeleteAuthUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth admin error" },
    });

    const result = await deleteMyAccount(
      { error: null },
      createDeleteFormData("削除する")
    );

    expect(result).toEqual({
      error:
        "認証アカウントの削除に失敗しました。時間をおいて再度お試しください。",
    });
    expect(mockDeleteManyUser).toHaveBeenCalledWith({
      where: { id: "user-123" },
    });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

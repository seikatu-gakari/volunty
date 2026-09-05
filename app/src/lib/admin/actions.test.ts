import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFindUser = vi.fn();
const mockFindUsers = vi.fn();
const mockUpdateUser = vi.fn();
const mockCountUsers = vi.fn();
const mockCountMatchingCandidates = vi.fn();
const mockCountOrganizations = vi.fn();
const mockFindOrganizations = vi.fn();
const mockFindOrganizationById = vi.fn();
const mockUpdateOrganization = vi.fn();
const mockRevalidatePath = vi.fn();
const mockFindDeletionRequests = vi.fn();
const mockFindDeletionRequest = vi.fn();
const mockProcessAccountDeletion = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

// Server Action から利用する page 専用 query を、Vitest でもサーバーモジュールとして読み込む。
vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUser(...args),
      findMany: (...args: unknown[]) => mockFindUsers(...args),
      update: (...args: unknown[]) => mockUpdateUser(...args),
      count: (...args: unknown[]) => mockCountUsers(...args),
    },
    matchingCandidate: {
      count: (...args: unknown[]) => mockCountMatchingCandidates(...args),
    },
    organizationProfile: {
      count: (...args: unknown[]) => mockCountOrganizations(...args),
      findMany: (...args: unknown[]) => mockFindOrganizations(...args),
      findUnique: (...args: unknown[]) => mockFindOrganizationById(...args),
      update: (...args: unknown[]) => mockUpdateOrganization(...args),
    },
    accountDeletionRequest: {
      findMany: (...args: unknown[]) => mockFindDeletionRequests(...args),
      findUnique: (...args: unknown[]) => mockFindDeletionRequest(...args),
    },
  },
}));

vi.mock("@/lib/account-deletion/orchestrator", () => ({
  processAccountDeletion: (...args: unknown[]) => mockProcessAccountDeletion(...args),
}));

const {
  fetchDashboardStats,
  fetchUsers,
  fetchOrganizations,
  fetchReviewHistory,
  fetchOrganizationById,
  approveOrganization,
  rejectOrganization,
  fetchPendingAccountDeletions,
  retryPendingAccountDeletion,
} = await import("./actions");

describe("admin/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "admin-1" } } });
    mockFindUser.mockResolvedValue({ role: "admin" });
    mockFindDeletionRequests.mockResolvedValue([]);
    mockFindDeletionRequest.mockResolvedValue({ userId: "participant-1" });
    mockProcessAccountDeletion.mockResolvedValue({ status: "completed" });
  });

  it("管理者は削除処理保留一覧を確認できる", async () => {
    mockFindDeletionRequests.mockResolvedValue([
      {
        userId: "participant-1",
        createdAt: new Date("2026-08-30T05:00:00.000Z"),
        attemptCount: 2,
        lastErrorCode: "data_cleanup_failed",
      },
    ]);
    mockFindUsers.mockResolvedValue([
      {
        id: "participant-1",
        name: null,
        participantProfile: { name: "参加者 太郎" },
        organizationProfile: null,
      },
    ]);

    await expect(fetchPendingAccountDeletions()).resolves.toEqual([
      {
        userId: "participant-1",
        displayName: "参加者 太郎",
        createdAt: "2026-08-30T05:00:00.000Z",
        attemptCount: 2,
        lastErrorCode: "data_cleanup_failed",
      },
    ]);
  });

  it("非管理者は削除処理保留一覧と再処理を利用できない", async () => {
    mockFindUser.mockResolvedValue({ role: "participant" });
    const formData = new FormData();
    formData.set("userId", "participant-1");

    await expect(fetchPendingAccountDeletions()).rejects.toThrow("管理者権限が必要です");
    await expect(retryPendingAccountDeletion(formData)).rejects.toThrow("管理者権限が必要です");
    expect(mockProcessAccountDeletion).not.toHaveBeenCalled();
  });

  it("管理者の再処理は共通 saga を呼び管理画面を再検証する", async () => {
    const formData = new FormData();
    formData.set("userId", "participant-1");

    await retryPendingAccountDeletion(formData);

    expect(mockProcessAccountDeletion).toHaveBeenCalledWith("participant-1");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("台帳にない対象は管理者でも削除処理を開始できない", async () => {
    mockFindDeletionRequest.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("userId", "participant-1");

    await expect(retryPendingAccountDeletion(formData)).rejects.toThrow(
      "保留中の削除処理が見つかりません"
    );
    expect(mockProcessAccountDeletion).not.toHaveBeenCalled();
  });

  it("団体一覧取得時に審査ステータスを含めて整形する", async () => {
    mockFindOrganizations.mockResolvedValue([
      {
        id: "org-1",
        userId: "user-1",
        organizationName: "テスト団体",
        representativeName: "担当者",
        contactEmail: "org@example.com",
        activityAreas: ["東京都"],
        description: "説明",
        activityCategories: ["子ども支援"],
        websiteUrl: "https://example.com",
        profileCompleteness: 80,
        reviewStatus: "rejected",
        reviewComment: "情報が不足しています",
        reviewedAt: new Date("2026-04-18T10:00:00.000Z"),
        reviewedBy: "admin-1",
        verified: false,
        createdAt: new Date("2026-04-17T10:00:00.000Z"),
      },
    ]);

    const result = await fetchOrganizations();

    expect(result).toEqual([
      expect.objectContaining({
        id: "org-1",
        reviewStatus: "rejected",
        reviewComment: "情報が不足しています",
        reviewedBy: "admin-1",
        reviewedAt: "2026-04-18T10:00:00.000Z",
        createdAt: "2026-04-17T10:00:00.000Z",
      }),
    ]);
  });

  it("ユーザー一覧取得時にロール別の補助情報と日付を整形する", async () => {
    mockFindUsers.mockResolvedValue([
      {
        id: "participant-1",
        role: "participant",
        email: "participant@example.com",
        name: "  ",
        avatarUrl: null,
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
        lastLoginAt: new Date("2026-06-19T10:00:00.000Z"),
        createdAt: new Date("2026-06-18T10:00:00.000Z"),
        participantProfile: {
          name: "参加者 太郎",
          region: "東京都",
        },
        organizationProfile: null,
      },
      {
        id: "organization-1",
        role: "organization",
        email: "org@example.com",
        name: null,
        avatarUrl: "https://example.com/avatar.png",
        isActive: false,
        suspendedAt: new Date("2026-06-19T12:00:00.000Z"),
        suspendReason: "規約違反のため",
        lastLoginAt: null,
        createdAt: new Date("2026-06-17T10:00:00.000Z"),
        participantProfile: null,
        organizationProfile: {
          organizationName: "テスト団体",
          verified: true,
        },
      },
      {
        id: "admin-1",
        role: "admin",
        email: null,
        name: "管理者",
        avatarUrl: null,
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
        lastLoginAt: null,
        createdAt: new Date("2026-06-16T10:00:00.000Z"),
        participantProfile: null,
        organizationProfile: null,
      },
    ]);

    const result = await fetchUsers();

    expect(mockFindUsers).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        role: true,
        email: true,
        name: true,
        avatarUrl: true,
        isActive: true,
        suspendedAt: true,
        suspendReason: true,
        lastLoginAt: true,
        createdAt: true,
        participantProfile: {
          select: { name: true, region: true },
        },
        organizationProfile: {
          select: { organizationName: true, verified: true },
        },
      },
    });
    expect(result).toEqual([
      {
        id: "participant-1",
        role: "participant",
        displayName: "参加者 太郎",
        email: "participant@example.com",
        avatarUrl: null,
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
        region: "東京都",
        organizationVerified: null,
        lastLoginAt: "2026-06-19T10:00:00.000Z",
        createdAt: "2026-06-18T10:00:00.000Z",
      },
      {
        id: "organization-1",
        role: "organization",
        displayName: "テスト団体",
        email: "org@example.com",
        avatarUrl: "https://example.com/avatar.png",
        isActive: false,
        suspendedAt: "2026-06-19T12:00:00.000Z",
        suspendReason: "規約違反のため",
        region: null,
        organizationVerified: true,
        lastLoginAt: null,
        createdAt: "2026-06-17T10:00:00.000Z",
      },
      {
        id: "admin-1",
        role: "admin",
        displayName: "管理者",
        email: null,
        avatarUrl: null,
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
        region: null,
        organizationVerified: null,
        lastLoginAt: null,
        createdAt: "2026-06-16T10:00:00.000Z",
      },
    ]);
  });

  it("審査履歴取得時に承認・否認済み団体を審査日時順で整形する", async () => {
    mockFindOrganizations.mockResolvedValue([
      {
        id: "org-2",
        organizationName: "承認済み団体",
        reviewStatus: "approved",
        reviewComment: null,
        reviewedAt: new Date("2026-04-19T09:00:00.000Z"),
        reviewedBy: "admin-2",
      },
      {
        id: "org-1",
        organizationName: "否認済み団体",
        reviewStatus: "rejected",
        reviewComment: "活動内容を補足してください",
        reviewedAt: new Date("2026-04-18T10:00:00.000Z"),
        reviewedBy: "admin-1",
      },
    ]);
    mockFindUsers.mockResolvedValue([
      { id: "admin-1", name: "管理者 一郎" },
      { id: "admin-2", name: "管理者 二郎" },
    ]);

    const result = await fetchReviewHistory();

    expect(mockFindOrganizations).toHaveBeenCalledWith({
      where: {
        reviewStatus: { in: ["approved", "rejected"] },
        reviewedAt: { not: null },
      },
      orderBy: { reviewedAt: "desc" },
      select: {
        id: true,
        organizationName: true,
        reviewStatus: true,
        reviewComment: true,
        reviewedAt: true,
        reviewedBy: true,
      },
    });
    expect(mockFindUsers).toHaveBeenCalledWith({
      where: { id: { in: ["admin-2", "admin-1"] } },
      select: { id: true, name: true },
    });
    expect(result).toEqual([
      {
        id: "org-2",
        organizationName: "承認済み団体",
        reviewStatus: "approved",
        reviewComment: null,
        reviewedAt: "2026-04-19T09:00:00.000Z",
        reviewedBy: "admin-2",
        reviewerName: "管理者 二郎",
      },
      {
        id: "org-1",
        organizationName: "否認済み団体",
        reviewStatus: "rejected",
        reviewComment: "活動内容を補足してください",
        reviewedAt: "2026-04-18T10:00:00.000Z",
        reviewedBy: "admin-1",
        reviewerName: "管理者 一郎",
      },
    ]);
  });

  it("ユーザー名とプロフィール名が空なら未設定表示にフォールバックする", async () => {
    mockFindUsers.mockResolvedValue([
      {
        id: "participant-1",
        role: "participant",
        email: "participant@example.com",
        name: " ",
        avatarUrl: null,
        isActive: true,
        suspendedAt: null,
        suspendReason: null,
        lastLoginAt: null,
        createdAt: new Date("2026-06-18T10:00:00.000Z"),
        participantProfile: {
          name: "",
          region: "東京都",
        },
        organizationProfile: null,
      },
    ]);

    const result = await fetchUsers();

    expect(result[0]?.displayName).toBe("(名前未設定)");
  });

  it("非管理者はユーザー一覧を取得できない", async () => {
    mockFindUser.mockResolvedValue({ role: "participant" });

    await expect(fetchUsers()).rejects.toThrow("管理者権限が必要です");
    expect(mockFindUsers).not.toHaveBeenCalled();
  });

  it("未ログインではユーザー一覧を取得できない", async () => {
    mockGetUser.mockReturnValue({ data: { user: null } });

    await expect(fetchUsers()).rejects.toThrow("認証が必要です");
    expect(mockFindUsers).not.toHaveBeenCalled();
  });

  it("審査者名を解決できない履歴は reviewerName を null にする", async () => {
    mockFindOrganizations.mockResolvedValue([
      {
        id: "org-1",
        organizationName: "審査者不明団体",
        reviewStatus: "rejected",
        reviewComment: "確認できません",
        reviewedAt: new Date("2026-04-18T10:00:00.000Z"),
        reviewedBy: "missing-admin",
      },
      {
        id: "org-2",
        organizationName: "移行データ団体",
        reviewStatus: "approved",
        reviewComment: null,
        reviewedAt: new Date("2026-04-17T10:00:00.000Z"),
        reviewedBy: null,
      },
    ]);
    mockFindUsers.mockResolvedValue([]);

    const result = await fetchReviewHistory();

    expect(mockFindUsers).toHaveBeenCalledWith({
      where: { id: { in: ["missing-admin"] } },
      select: { id: true, name: true },
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: "org-1",
        reviewedBy: "missing-admin",
        reviewerName: null,
      }),
      expect.objectContaining({
        id: "org-2",
        reviewedBy: null,
        reviewerName: null,
      }),
    ]);
  });

  it("非管理者は審査履歴を取得できない", async () => {
    mockFindUser.mockResolvedValue({ role: "participant" });

    await expect(fetchReviewHistory()).rejects.toThrow("管理者権限が必要です");
    expect(mockFindOrganizations).not.toHaveBeenCalled();
    expect(mockFindUsers).not.toHaveBeenCalled();
  });

  it("管理ダッシュボード用のサマリ件数を取得する", async () => {
    mockCountUsers.mockResolvedValue(12);
    mockCountMatchingCandidates.mockResolvedValue(34);
    mockCountOrganizations.mockResolvedValue(5);

    const result = await fetchDashboardStats();

    expect(result).toEqual({
      userCount: 12,
      matchingCount: 34,
      pendingReviewCount: 5,
    });
    expect(mockCountUsers).toHaveBeenCalledWith({
      where: { role: { not: "admin" } },
    });
    expect(mockCountMatchingCandidates).toHaveBeenCalledWith({
      where: { status: { in: ["applied", "accepted", "completed"] } },
    });
    expect(mockCountOrganizations).toHaveBeenCalledWith({
      where: { reviewStatus: "pending" },
    });
  });

  it("単一団体取得時に管理者以外はエラーにする", async () => {
    mockFindUser.mockResolvedValue({ role: "participant" });

    await expect(fetchOrganizationById("org-1")).rejects.toThrow(
      "管理者権限が必要です"
    );
    expect(mockFindOrganizationById).not.toHaveBeenCalled();
  });

  it("単一団体取得時に存在する団体を整形して返す", async () => {
    mockFindOrganizationById.mockResolvedValue({
      id: "org-1",
      userId: "user-1",
      organizationName: "テスト団体",
      representativeName: "担当者",
      contactEmail: "org@example.com",
      activityAreas: ["東京都"],
      description: "説明",
      activityCategories: ["子ども支援"],
      websiteUrl: "https://example.com",
      profileCompleteness: 80,
      reviewStatus: "pending",
      reviewComment: null,
      reviewedAt: null,
      reviewedBy: null,
      verified: false,
      createdAt: new Date("2026-04-17T10:00:00.000Z"),
    });

    const result = await fetchOrganizationById("org-1");

    expect(mockFindOrganizationById).toHaveBeenCalledWith({
      where: { id: "org-1" },
      select: expect.objectContaining({
        id: true,
        reviewStatus: true,
        createdAt: true,
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: "org-1",
        activityAreas: ["東京都"],
        activityCategories: ["子ども支援"],
        reviewedAt: null,
        createdAt: "2026-04-17T10:00:00.000Z",
      })
    );
  });

  it("単一団体取得時に存在しない団体は null を返す", async () => {
    mockFindOrganizationById.mockResolvedValue(null);

    await expect(fetchOrganizationById("missing-org")).resolves.toBeNull();
  });

  it("承認時に承認状態と監査情報を更新する", async () => {
    mockUpdateOrganization.mockResolvedValue({});

    const result = await approveOrganization("org-1");

    expect(result).toEqual({ success: true });
    expect(mockUpdateOrganization).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining({
        verified: true,
        reviewStatus: "approved",
        reviewComment: null,
        reviewedBy: "admin-1",
      }),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/organizations");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/onboarding/pending");
  });

  it("否認時に理由が空ならエラーを返す", async () => {
    const result = await rejectOrganization("org-1", "   ");

    expect(result).toEqual({ success: false, error: "否認理由を入力してください" });
    expect(mockUpdateOrganization).not.toHaveBeenCalled();
  });

  it("否認時に否認理由と監査情報を更新する", async () => {
    mockUpdateOrganization.mockResolvedValue({});

    const result = await rejectOrganization("org-1", "提出情報を補足してください");

    expect(result).toEqual({ success: true });
    expect(mockUpdateOrganization).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining({
        verified: false,
        reviewStatus: "rejected",
        reviewComment: "提出情報を補足してください",
        reviewedBy: "admin-1",
      }),
    });
  });

  describe("suspendUser", () => {
    it("管理者が参加者を凍結できる", async () => {
      mockFindUser
        .mockResolvedValueOnce({ role: "admin" })
        .mockResolvedValueOnce({ id: "target-1", role: "participant" });
      mockUpdateUser.mockResolvedValue({});

      const { suspendUser } = await import("./actions");
      const result = await suspendUser("target-1", "規約違反のため");

      expect(result.success).toBe(true);
      expect(mockUpdateUser).toHaveBeenCalledWith({
        where: { id: "target-1" },
        data: expect.objectContaining({
          isActive: false,
          suspendReason: "規約違反のため",
          suspendedBy: "admin-1",
        }),
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
    });

    it("理由が空なら失敗する", async () => {
      mockFindUser.mockResolvedValueOnce({ role: "admin" });

      const { suspendUser } = await import("./actions");
      const result = await suspendUser("target-1", "   ");

      expect(result).toEqual({
        success: false,
        error: "凍結理由を入力してください",
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("管理者ロールのユーザーは凍結できない", async () => {
      mockFindUser
        .mockResolvedValueOnce({ role: "admin" })
        .mockResolvedValueOnce({ id: "target-admin", role: "admin" });

      const { suspendUser } = await import("./actions");
      const result = await suspendUser("target-admin", "理由");

      expect(result).toEqual({
        success: false,
        error: "管理者は凍結できません",
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("自分自身は凍結できない", async () => {
      mockFindUser.mockResolvedValueOnce({ role: "admin" });

      const { suspendUser } = await import("./actions");
      const result = await suspendUser("admin-1", "理由");

      expect(result).toEqual({
        success: false,
        error: "自分自身は凍結できません",
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });
  });

  describe("reactivateUser", () => {
    it("凍結を解除し監査カラムをクリアする", async () => {
      mockFindUser.mockResolvedValueOnce({ role: "admin" });
      mockUpdateUser.mockResolvedValue({});

      const { reactivateUser } = await import("./actions");
      const result = await reactivateUser("target-1");

      expect(result.success).toBe(true);
      expect(mockUpdateUser).toHaveBeenCalledWith({
        where: { id: "target-1" },
        data: {
          isActive: true,
          suspendedAt: null,
          suspendReason: null,
          suspendedBy: null,
        },
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/users");
    });
  });
});

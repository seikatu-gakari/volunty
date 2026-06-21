import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFindUser = vi.fn();
const mockFindUsers = vi.fn();
const mockFindOrganizations = vi.fn();
const mockUpdateOrganization = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

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
    },
    organizationProfile: {
      findMany: (...args: unknown[]) => mockFindOrganizations(...args),
      update: (...args: unknown[]) => mockUpdateOrganization(...args),
    },
  },
}));

const {
  fetchOrganizations,
  fetchReviewHistory,
  approveOrganization,
  rejectOrganization,
} = await import("./actions");

describe("admin/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ data: { user: { id: "admin-1" } } });
    mockFindUser.mockResolvedValue({ role: "admin" });
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
});

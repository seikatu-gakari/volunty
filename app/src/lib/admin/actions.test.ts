import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFindUser = vi.fn();
const mockCountUsers = vi.fn();
const mockCountMatchingCandidates = vi.fn();
const mockCountOrganizations = vi.fn();
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
      count: (...args: unknown[]) => mockCountUsers(...args),
    },
    matchingCandidate: {
      count: (...args: unknown[]) => mockCountMatchingCandidates(...args),
    },
    organizationProfile: {
      count: (...args: unknown[]) => mockCountOrganizations(...args),
      findMany: (...args: unknown[]) => mockFindOrganizations(...args),
      update: (...args: unknown[]) => mockUpdateOrganization(...args),
    },
  },
}));

const {
  fetchDashboardStats,
  fetchOrganizations,
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

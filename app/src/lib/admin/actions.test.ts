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

const { fetchUsers, fetchOrganizations, approveOrganization, rejectOrganization } = await import("./actions");

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

  it("ユーザー一覧取得時にロール別の補助情報と日付を整形する", async () => {
    mockFindUsers.mockResolvedValue([
      {
        id: "participant-1",
        role: "participant",
        email: "participant@example.com",
        name: "  ",
        avatarUrl: null,
        isActive: true,
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
        region: null,
        organizationVerified: null,
        lastLoginAt: null,
        createdAt: "2026-06-16T10:00:00.000Z",
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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
      updateUser: (data: unknown) => mockUpdateUser(data),
    },
  }),
}));

// Prisma のモック
const mockPrismaUserUpdate = vi.fn();
const mockPrismaUserUpsert = vi.fn();
const mockPrismaUserFindUnique = vi.fn();
const mockPrismaOrgUpsert = vi.fn();
const mockPrismaParticipantUpsert = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: (...args: unknown[]) => mockPrismaUserUpdate(...args),
      upsert: (...args: unknown[]) => mockPrismaUserUpsert(...args),
      findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args),
    },
    organizationProfile: {
      upsert: (...args: unknown[]) => mockPrismaOrgUpsert(...args),
    },
    participantProfile: {
      upsert: (...args: unknown[]) => mockPrismaParticipantUpsert(...args),
      findUnique: vi.fn(),
    },
  },
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { selectRole, registerParticipant, registerOrganization } = await import("./actions");

describe("selectRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaUserUpsert.mockResolvedValue({});
  });

  it("未認証の場合、失敗結果を返し永続化しない", async () => {
    mockGetUser.mockReturnValue({ data: { user: null } });

    await expect(selectRole("participant")).resolves.toEqual({
      success: false,
      error: "ロールの保存中にエラーが発生しました",
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockPrismaUserUpsert).not.toHaveBeenCalled();
  });

  it("参加者ロール設定成功後、遷移先を含む成功結果を返す", async () => {
    mockGetUser.mockReturnValue({
      data: {
        user: {
          id: "user-123",
          email: "participant@example.com",
          user_metadata: {
            full_name: "参加 太郎",
            avatar_url: "https://example.com/avatar.png",
          },
        },
      },
    });
    mockUpdateUser.mockReturnValue({ error: null });

    await expect(selectRole("participant")).resolves.toEqual({
      success: true,
      redirectTo: "/onboarding/participant",
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { role: "participant" } });
    expect(mockPrismaUserUpsert).toHaveBeenCalledWith({
      where: { id: "user-123" },
      update: expect.objectContaining({
        email: "participant@example.com",
        name: "参加 太郎",
        avatarUrl: "https://example.com/avatar.png",
        lastLoginAt: expect.any(Date),
        role: "participant",
      }),
      create: expect.objectContaining({
        id: "user-123",
        email: "participant@example.com",
        name: "参加 太郎",
        avatarUrl: "https://example.com/avatar.png",
        lastLoginAt: expect.any(Date),
        role: "participant",
      }),
      select: {
        role: true,
        participantProfile: { select: { id: true } },
        organizationProfile: { select: { id: true } },
      },
    });
  });

  it("団体ロール設定成功後、遷移先を含む成功結果を返す", async () => {
    mockGetUser.mockReturnValue({
      data: {
        user: {
          id: "user-456",
          email: "organization@example.com",
          user_metadata: {
            name: "団体 花子",
          },
        },
      },
    });
    mockUpdateUser.mockReturnValue({ error: null });

    await expect(selectRole("organization")).resolves.toEqual({
      success: true,
      redirectTo: "/onboarding/organization",
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { role: "organization" } });
    expect(mockPrismaUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-456" },
        update: expect.objectContaining({ role: "organization" }),
        create: expect.objectContaining({ role: "organization" }),
      })
    );
  });

  it("Supabase Auth 更新エラー時、失敗結果を返しDB同期しない", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockUpdateUser.mockReturnValue({ error: { message: "Auth error" } });

    await expect(selectRole("participant")).resolves.toEqual({
      success: false,
      error: "ロールの保存中にエラーが発生しました",
    });
    expect(mockPrismaUserUpsert).not.toHaveBeenCalled();
  });

  it("DB同期エラー時、失敗結果を返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockUpdateUser.mockReturnValue({ error: null });
    mockPrismaUserUpsert.mockRejectedValue(new Error("DB error"));

    await expect(selectRole("participant")).resolves.toEqual({
      success: false,
      error: "ロールの保存中にエラーが発生しました",
    });
  });
});

describe("registerParticipant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaUserUpsert.mockResolvedValue({});
    mockPrismaUserFindUnique.mockResolvedValue({ role: "participant" });
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: null } });

    const result = await registerParticipant({
      name: "山田 太郎",
      birthday: "1990-01-15",
      region: "東京都",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("ログインが必要です");
    expect(mockPrismaParticipantUpsert).not.toHaveBeenCalled();
  });

  it("organization ロールの場合、参加者プロフィールを登録できない", async () => {
    mockGetUser.mockReturnValue({
      data: {
        user: {
          id: "org-user-123",
          email: "org@example.com",
          user_metadata: { role: "organization" },
        },
      },
    });
    mockPrismaUserFindUnique.mockResolvedValue({ role: "organization" });

    const result = await registerParticipant({
      name: "団体ユーザー",
      birthday: "1990-01-15",
      region: "東京都",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("参加者アカウントでログインしてください");
    expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
      where: { id: "org-user-123" },
      select: { role: true },
    });
    expect(mockPrismaUserUpsert).not.toHaveBeenCalled();
    expect(mockPrismaParticipantUpsert).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("ロール未選択の場合、参加者プロフィールを登録できない", async () => {
    mockGetUser.mockReturnValue({
      data: {
        user: {
          id: "no-role-user-123",
          email: "user@example.com",
          user_metadata: {},
        },
      },
    });
    mockPrismaUserFindUnique.mockResolvedValue(null);

    const result = await registerParticipant({
      name: "未選択ユーザー",
      birthday: "1990-01-15",
      region: "東京都",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("参加者ロールの選択が必要です");
    expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
      where: { id: "no-role-user-123" },
      select: { role: true },
    });
    expect(mockPrismaUserUpsert).not.toHaveBeenCalled();
    expect(mockPrismaParticipantUpsert).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("nameが空の場合、バリデーションエラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });

    const result = await registerParticipant({
      name: "",
      birthday: "1990-01-15",
      region: "東京都",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("表示名は必須です");
    expect(mockPrismaParticipantUpsert).not.toHaveBeenCalled();
  });

  it("birthdayが空の場合、バリデーションエラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });

    const result = await registerParticipant({
      name: "山田 太郎",
      birthday: "",
      region: "東京都",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("生年月日は必須です");
    expect(mockPrismaParticipantUpsert).not.toHaveBeenCalled();
  });

  it("regionが空の場合、バリデーションエラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });

    const result = await registerParticipant({
      name: "山田 太郎",
      birthday: "1990-01-15",
      region: "",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("都道府県は必須です");
    expect(mockPrismaParticipantUpsert).not.toHaveBeenCalled();
  });

  it("全フィールドを指定して正常登録後、/diagnosis にリダイレクトする", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockPrismaParticipantUpsert.mockResolvedValue({});
    mockUpdateUser.mockReturnValue({ error: null });

    const result = await registerParticipant({
      name: "山田 太郎",
      birthday: "1990-01-15",
      gender: "male",
      region: "東京都",
      bio: "ボランティア活動が好きです",
      interests: ["環境保全", "子ども支援"],
    });

    expect(result).toEqual({ success: true });
    expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: { role: true },
    });

    expect(mockPrismaParticipantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-123" },
        create: expect.objectContaining({
          userId: "user-123",
          name: "山田 太郎",
          birthday: new Date("1990-01-15"),
          gender: "male",
          region: "東京都",
          bio: "ボランティア活動が好きです",
          interests: ["環境保全", "子ども支援"],
        }),
      })
    );
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { onboarding_completed: true },
    });
  });

  it("任意フィールドを省略して正常登録後、/diagnosis にリダイレクトする", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-456" } } });
    mockPrismaParticipantUpsert.mockResolvedValue({});
    mockUpdateUser.mockReturnValue({ error: null });

    const result = await registerParticipant({
      name: "鈴木 花子",
      birthday: "1985-06-20",
      region: "大阪府",
    });

    expect(result).toEqual({ success: true });

    expect(mockPrismaParticipantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-456" },
        create: expect.objectContaining({
          userId: "user-456",
          name: "鈴木 花子",
          birthday: new Date("1985-06-20"),
          gender: null,
          region: "大阪府",
          bio: null,
          interests: Prisma.JsonNull,
        }),
      })
    );
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { onboarding_completed: true },
    });
  });

  it("upsert エラー時、エラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockPrismaParticipantUpsert.mockRejectedValue(new Error("duplicate key"));

    const result = await registerParticipant({
      name: "山田 太郎",
      birthday: "1990-01-15",
      region: "東京都",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("予期しないエラーが発生しました");
  });
});

describe("registerOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaUserUpsert.mockResolvedValue({});
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: null } });

    const result = await registerOrganization({
      organizationName: "NPO法人テスト",
      representativeName: "山田 太郎",
      contactEmail: "contact@example.org",
      activityAreas: ["東京都"],
      contactLineId: "@test_org",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("ログインが必要です");
    expect(mockPrismaOrgUpsert).not.toHaveBeenCalled();
  });

  it("団体名が空の場合、バリデーションエラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });

    const result = await registerOrganization({
      organizationName: "",
      representativeName: "山田 太郎",
      contactEmail: "contact@example.org",
      activityAreas: ["東京都"],
      contactLineId: "@test_org",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("団体名は必須です");
    expect(mockPrismaOrgUpsert).not.toHaveBeenCalled();
  });

  it("代表者名が空の場合、バリデーションエラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });

    const result = await registerOrganization({
      organizationName: "NPO法人テスト",
      representativeName: "",
      contactEmail: "contact@example.org",
      activityAreas: ["東京都"],
      contactLineId: "@test_org",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("代表者名は必須です");
    expect(mockPrismaOrgUpsert).not.toHaveBeenCalled();
  });

  it("連絡先メールが空の場合、バリデーションエラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });

    const result = await registerOrganization({
      organizationName: "NPO法人テスト",
      representativeName: "山田 太郎",
      contactEmail: "",
      activityAreas: ["東京都"],
      contactLineId: "@test_org",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("連絡先メールアドレスは必須です");
    expect(mockPrismaOrgUpsert).not.toHaveBeenCalled();
  });

  it("活動地域が空の場合、バリデーションエラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });

    const result = await registerOrganization({
      organizationName: "NPO法人テスト",
      representativeName: "山田 太郎",
      contactEmail: "contact@example.org",
      activityAreas: [],
      contactLineId: "@test_org",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("活動地域を1つ以上選択してください");
    expect(mockPrismaOrgUpsert).not.toHaveBeenCalled();
  });

  it("LINE公式アカウントIDが空の場合、バリデーションエラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });

    const result = await registerOrganization({
      organizationName: "NPO法人テスト",
      representativeName: "山田 太郎",
      contactEmail: "contact@example.org",
      activityAreas: ["東京都"],
      contactLineId: "   ",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("LINE公式アカウントIDは必須です");
    expect(mockPrismaOrgUpsert).not.toHaveBeenCalled();
  });

  it("必須フィールドのみで正常登録できる（充実度50）", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockPrismaOrgUpsert.mockResolvedValue({});
    mockUpdateUser.mockReturnValue({ error: null });

    const result = await registerOrganization({
      organizationName: "NPO法人テスト",
      representativeName: "山田 太郎",
      contactEmail: "contact@example.org",
      activityAreas: ["東京都"],
      contactLineId: "  @test_org  ",
    });

    expect(result.success).toBe(true);
    expect(mockPrismaOrgUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-123" },
        create: expect.objectContaining({
          organizationName: "NPO法人テスト",
          representativeName: "山田 太郎",
          contactEmail: "contact@example.org",
          activityAreas: ["東京都"],
          contactLineId: "@test_org",
          contactLineUrl: null,
          profileCompleteness: 50,
        }),
        update: expect.objectContaining({
          contactLineId: "@test_org",
          contactLineUrl: null,
          profileCompleteness: 50,
        }),
      })
    );
  });

  it("全フィールドを指定して正常登録できる（充実度100）", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-456" } } });
    mockPrismaOrgUpsert.mockResolvedValue({});
    mockUpdateUser.mockReturnValue({ error: null });

    const result = await registerOrganization({
      organizationName: "NPO法人フル",
      representativeName: "鈴木 花子",
      contactEmail: "info@full.org",
      activityAreas: ["大阪府", "京都府"],
      description: "活動説明テキスト",
      activityCategories: ["環境保全", "子ども支援"],
      websiteUrl: "https://example.org",
      logoUrl: "https://example.org/logo.png",
      contactLineId: "@full_org",
      contactLineUrl: "https://line.me/R/ti/p/@full",
    });

    expect(result.success).toBe(true);
    expect(mockPrismaOrgUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          profileCompleteness: 100,
          description: "活動説明テキスト",
          activityCategories: ["環境保全", "子ども支援"],
        }),
      })
    );
  });

  it("onboarding_completed フラグをセットする", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockPrismaOrgUpsert.mockResolvedValue({});
    mockUpdateUser.mockReturnValue({ error: null });

    await registerOrganization({
      organizationName: "NPO法人テスト",
      representativeName: "山田 太郎",
      contactEmail: "contact@example.org",
      activityAreas: ["東京都"],
      contactLineId: "@test_org",
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { onboarding_completed: true },
    });
  });
});

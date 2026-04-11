import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

// Next.js redirect のモック
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error("NEXT_REDIRECT");
  },
}));

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
const mockPrismaOrgUpsert = vi.fn();
const mockPrismaParticipantUpsert = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: (...args: unknown[]) => mockPrismaUserUpdate(...args),
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
  });

  it("未認証の場合、エラーをスローする", async () => {
    mockGetUser.mockReturnValue({ data: { user: null } });

    await expect(selectRole("participant")).rejects.toThrow("認証が必要です");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("参加者ロール設定成功後、/onboarding/participant にリダイレクトする", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockUpdateUser.mockReturnValue({ error: null });
    mockPrismaUserUpdate.mockResolvedValue({});

    await expect(selectRole("participant")).rejects.toThrow("NEXT_REDIRECT");

    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { role: "participant" } });
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { role: "participant" },
    });
    expect(mockRedirect).toHaveBeenCalledWith("/onboarding/participant");
  });

  it("団体ロール設定成功後、/onboarding/organization にリダイレクトする", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-456" } } });
    mockUpdateUser.mockReturnValue({ error: null });
    mockPrismaUserUpdate.mockResolvedValue({});

    await expect(selectRole("organization")).rejects.toThrow("NEXT_REDIRECT");

    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { role: "organization" } });
    expect(mockRedirect).toHaveBeenCalledWith("/onboarding/organization");
  });

  it("Supabase Auth 更新エラー時、エラーをスローしリダイレクトしない", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockUpdateUser.mockReturnValue({ error: { message: "Auth error" } });

    await expect(selectRole("participant")).rejects.toThrow(
      "ロール更新に失敗しました: Auth error"
    );
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("registerParticipant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    await expect(
      registerParticipant({
        name: "山田 太郎",
        birthday: "1990-01-15",
        gender: "male",
        region: "東京都",
        bio: "ボランティア活動が好きです",
        interests: ["環境保全", "子ども支援"],
      })
    ).rejects.toThrow("NEXT_REDIRECT");

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
    expect(mockRedirect).toHaveBeenCalledWith("/diagnosis");
  });

  it("任意フィールドを省略して正常登録後、/diagnosis にリダイレクトする", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-456" } } });
    mockPrismaParticipantUpsert.mockResolvedValue({});

    await expect(
      registerParticipant({
        name: "鈴木 花子",
        birthday: "1985-06-20",
        region: "大阪府",
      })
    ).rejects.toThrow("NEXT_REDIRECT");

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
    expect(mockRedirect).toHaveBeenCalledWith("/diagnosis");
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
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("registerOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、エラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: null } });

    const result = await registerOrganization({
      organizationName: "NPO法人テスト",
      representativeName: "山田 太郎",
      contactEmail: "contact@example.org",
      activityAreas: ["東京都"],
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
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("活動地域を1つ以上選択してください");
    expect(mockPrismaOrgUpsert).not.toHaveBeenCalled();
  });

  it("必須フィールドのみで正常登録できる（充実度40）", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockPrismaOrgUpsert.mockResolvedValue({});
    mockUpdateUser.mockReturnValue({ error: null });

    const result = await registerOrganization({
      organizationName: "NPO法人テスト",
      representativeName: "山田 太郎",
      contactEmail: "contact@example.org",
      activityAreas: ["東京都"],
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
          profileCompleteness: 40,
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
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { onboarding_completed: true },
    });
  });
});

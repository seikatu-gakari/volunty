import { describe, it, expect, vi, beforeEach } from "vitest";

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
const mockInsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
      updateUser: (data: unknown) => mockUpdateUser(data),
    },
    from: () => ({
      insert: (data: unknown) => mockInsert(data),
    }),
  }),
}));

// Prisma のモック
const mockPrismaUserUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: (...args: unknown[]) => mockPrismaUserUpdate(...args),
    },
  },
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { selectRole, registerParticipant } = await import("./actions");

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
    expect(mockInsert).not.toHaveBeenCalled();
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
    expect(mockInsert).not.toHaveBeenCalled();
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
    expect(mockInsert).not.toHaveBeenCalled();
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
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("全フィールドを指定して正常登録できる", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockInsert.mockReturnValue({ error: null });

    const result = await registerParticipant({
      name: "山田 太郎",
      birthday: "1990-01-15",
      gender: "male",
      region: "東京都",
      bio: "ボランティア活動が好きです",
      interests: ["環境保全", "子ども支援"],
    });

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({
      id: "user-123",
      name: "山田 太郎",
      birthday: "1990-01-15",
      gender: "male",
      region: "東京都",
      bio: "ボランティア活動が好きです",
      interests: ["環境保全", "子ども支援"],
    });
  });

  it("任意フィールドを省略して正常登録できる", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-456" } } });
    mockInsert.mockReturnValue({ error: null });

    const result = await registerParticipant({
      name: "鈴木 花子",
      birthday: "1985-06-20",
      region: "大阪府",
    });

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({
      id: "user-456",
      name: "鈴木 花子",
      birthday: "1985-06-20",
      gender: null,
      region: "大阪府",
      bio: null,
      interests: null,
    });
  });

  it("INSERT エラー時、エラーを返す", async () => {
    mockGetUser.mockReturnValue({ data: { user: { id: "user-123" } } });
    mockInsert.mockReturnValue({ error: { message: "duplicate key" } });

    const result = await registerParticipant({
      name: "山田 太郎",
      birthday: "1990-01-15",
      region: "東京都",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("プロフィールの登録に失敗しました");
  });
});


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

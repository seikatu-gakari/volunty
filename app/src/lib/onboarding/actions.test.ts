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
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: (...args: unknown[]) => mockPrismaUserUpdate(...args),
    },
  },
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { selectRole } = await import("./actions");

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

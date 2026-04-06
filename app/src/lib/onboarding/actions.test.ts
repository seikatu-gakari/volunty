import { describe, it, expect, vi, beforeEach } from "vitest";

// Next.js redirect のモック
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    // Next.js の redirect() は内部的に NEXT_REDIRECT エラーをスローする
    throw new Error("NEXT_REDIRECT");
  },
}));

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      update: (data: unknown) => {
        mockUpdate(data);
        return {
          eq: (...args: unknown[]) => mockEq(...args),
        };
      },
    }),
  }),
}));

// "use server" ディレクティブを含むモジュールの動的インポート
const { setUserRole } = await import("./actions");

describe("setUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未認証の場合、/login にリダイレクトする", async () => {
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    await expect(setUserRole("participant")).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("参加者ロール設定成功後、/onboarding/participant にリダイレクトする", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockEq.mockReturnValue({ error: null });

    await expect(setUserRole("participant")).rejects.toThrow("NEXT_REDIRECT");

    expect(mockUpdate).toHaveBeenCalledWith({ role: "participant" });
    expect(mockEq).toHaveBeenCalledWith("id", "user-123");
    expect(mockRedirect).toHaveBeenCalledWith("/onboarding/participant");
  });

  it("団体ロール設定成功後、/onboarding/organization にリダイレクトする", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-456" } },
      error: null,
    });
    mockEq.mockReturnValue({ error: null });

    await expect(setUserRole("organization")).rejects.toThrow("NEXT_REDIRECT");

    expect(mockUpdate).toHaveBeenCalledWith({ role: "organization" });
    expect(mockRedirect).toHaveBeenCalledWith("/onboarding/organization");
  });

  it("DB 更新エラー時、エラーオブジェクトを返しリダイレクトしない", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockEq.mockReturnValue({ error: { message: "DB error" } });

    const result = await setUserRole("participant");

    expect(result).toEqual({ error: "ロールの設定に失敗しました" });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

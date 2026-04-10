import { describe, it, expect, vi, beforeEach } from "vitest";

// Next.js navigation モック（redirect は NEXT_REDIRECT エラーをスローする）
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT: ${url}`), {
      digest: `NEXT_REDIRECT;replace;${url};`,
    });
  }),
}));

// Supabase クライアントのモック
const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockPrismaUserUpdate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
      updateUser: (data: unknown) => mockUpdateUser(data),
    },
  }),
}));

// Prisma モック
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: (args: unknown) => mockPrismaUserUpdate(args),
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
    mockGetUser.mockReturnValue({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    await expect(selectRole("participant")).rejects.toThrow("認証が必要です");
  });

  it("participant を選択すると /onboarding/participant へリダイレクトする", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockUpdateUser.mockReturnValue({ error: null });
    mockPrismaUserUpdate.mockResolvedValue({});

    await expect(selectRole("participant")).rejects.toMatchObject({
      digest: expect.stringContaining("/onboarding/participant"),
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { role: "participant" },
    });
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: { role: "participant" },
    });
  });

  it("organization を選択すると /onboarding/organization へリダイレクトする", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-456" } },
      error: null,
    });
    mockUpdateUser.mockReturnValue({ error: null });
    mockPrismaUserUpdate.mockResolvedValue({});

    await expect(selectRole("organization")).rejects.toMatchObject({
      digest: expect.stringContaining("/onboarding/organization"),
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { role: "organization" },
    });
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-456" },
      data: { role: "organization" },
    });
  });

  it("Supabase Auth の updateUser が失敗した場合、エラーをスローする", async () => {
    mockGetUser.mockReturnValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    mockUpdateUser.mockReturnValue({
      error: { message: "Update failed" },
    });

    await expect(selectRole("participant")).rejects.toThrow(
      "ロール更新に失敗しました: Update failed"
    );
  });
});

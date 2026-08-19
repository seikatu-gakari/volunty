import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  ensureUserRecord: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getUser: mocks.getUser,
    },
  }),
}));

vi.mock("@/lib/auth/ensure-user-record", () => ({
  ensureUserRecord: mocks.ensureUserRecord,
}));

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "user@example.com",
          user_metadata: { full_name: "山田 太郎" },
        },
      },
      error: null,
    });
    mocks.ensureUserRecord.mockResolvedValue({
      role: "participant",
      hasParticipantProfile: true,
      hasOrganizationProfile: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("セッション交換成功時はログイン成功トースト付きで next にリダイレクトする", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const response = await GET(
      new Request(
        "http://0.0.0.0:3000/auth/callback?code=ok&next=%2Fmypage%3Ftab%3Dprofile"
      )
    );

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("ok");
    expect(mocks.getUser).toHaveBeenCalled();
    expect(mocks.ensureUserRecord).toHaveBeenCalledWith({
      id: "user-123",
      email: "user@example.com",
      user_metadata: { full_name: "山田 太郎" },
    });
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/mypage?tab=profile&toast=login-success"
    );
  });

  it("セッション交換失敗時はログイン失敗トースト用パラメータ付きでログイン画面へ戻す", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({
      error: { name: "AuthApiError", message: "bad request", status: 400 },
    });

    const response = await GET(
      new Request("http://0.0.0.0:3000/auth/callback?code=ng")
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=auth"
    );
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.ensureUserRecord).not.toHaveBeenCalled();
  });

  it("ユーザー取得に失敗した場合は user-sync エラーでログイン画面へ戻す", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "user not found" },
    });

    const response = await GET(
      new Request("http://0.0.0.0:3000/auth/callback?code=ok")
    );

    expect(mocks.ensureUserRecord).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=user-sync"
    );
  });

  it("m_user 同期に失敗した場合は user-sync エラーでログイン画面へ戻す", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mocks.ensureUserRecord.mockRejectedValueOnce(new Error("DB error"));

    const response = await GET(
      new Request("http://0.0.0.0:3000/auth/callback?code=ok")
    );

    expect(mocks.getUser).toHaveBeenCalled();
    expect(mocks.ensureUserRecord).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?error=user-sync"
    );
  });

  it("next が外部 URL の場合はトップへフォールバックする", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const response = await GET(
      new Request(
        "http://0.0.0.0:3000/auth/callback?code=ok&next=https%3A%2F%2Fevil.example%2F"
      )
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?toast=login-success"
    );
  });

  it("対応プロフィールがないparticipantはrole設定済みでもロール選択へ戻す", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "participant-incomplete-1",
          email: "participant@example.com",
          user_metadata: { role: "participant", onboarding_completed: true },
        },
      },
      error: null,
    });
    mocks.ensureUserRecord.mockResolvedValueOnce({
      role: "participant",
      hasParticipantProfile: false,
      hasOrganizationProfile: false,
    });

    const response = await GET(
      new Request(
        "http://0.0.0.0:3000/auth/callback?code=ok&next=%2Fmypage"
      )
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/onboarding/role?toast=login-success"
    );
  });

  it("対応プロフィールがないorganizationもロール選択へ戻す", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mocks.ensureUserRecord.mockResolvedValueOnce({
      role: "organization",
      hasParticipantProfile: false,
      hasOrganizationProfile: false,
    });

    const response = await GET(
      new Request("http://0.0.0.0:3000/auth/callback?code=ok")
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/onboarding/role?toast=login-success"
    );
  });

  it.each([
    ["participant", { hasParticipantProfile: true, hasOrganizationProfile: false }],
    ["organization", { hasParticipantProfile: false, hasOrganizationProfile: true }],
    ["admin", { hasParticipantProfile: false, hasOrganizationProfile: false }],
  ] as const)("%sの対応プロフィール完了時はsafe nextを維持する", async (role, profiles) => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mocks.ensureUserRecord.mockResolvedValueOnce({ role, ...profiles });

    const response = await GET(
      new Request(
        "http://0.0.0.0:3000/auth/callback?code=ok&next=%2Fmypage%3Ftab%3Dprofile"
      )
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/mypage?tab=profile&toast=login-success"
    );
  });

  it("プロフィール完了済みならバックスラッシュ入りnextをトップへフォールバックする", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });

    const response = await GET(
      new Request(
        "http://0.0.0.0:3000/auth/callback?code=ok&next=%2F%5Cevil.example"
      )
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?toast=login-success"
    );
  });
});

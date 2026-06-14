import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
    },
  }),
}));

describe("auth callback route", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
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
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseAnonKey: () => "anon-key",
  getSupabaseServerUrl: () => "https://supabase.example.com",
  SUPABASE_AUTH_COOKIE_NAME: "sb-test-auth-token",
}));

import { updateSession } from "./middleware";

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockReturnValue({
      auth: { getClaims: mocks.getClaims },
    });
  });

  it("検証済みclaimsからProxy用の最小identityを返し、getUserを使わない", async () => {
    mocks.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-1",
          email: "user@example.com",
          user_metadata: { full_name: "テスト 太郎" },
        },
      },
      error: null,
    });

    const result = await updateSession(
      new NextRequest("http://localhost:3000/mypage"),
    );

    expect(result.identity).toEqual({
      id: "user-1",
      email: "user@example.com",
      displayName: "テスト 太郎",
    });
    expect(mocks.getClaims).toHaveBeenCalledTimes(1);
  });

  it("claims更新で発行されたcookieをレスポンスへ引き継ぐ", async () => {
    mocks.createServerClient.mockImplementation((_url, _key, options) => {
      options.cookies.setAll([
        {
          name: "sb-test-auth-token",
          value: "refreshed-token",
          options: { httpOnly: true, path: "/" },
        },
      ]);
      return { auth: { getClaims: mocks.getClaims } };
    });
    mocks.getClaims.mockResolvedValue({ data: null, error: null });

    const result = await updateSession(
      new NextRequest("http://localhost:3000/opportunities"),
    );

    expect(result.response.cookies.get("sb-test-auth-token")?.value).toBe(
      "refreshed-token",
    );
  });
});

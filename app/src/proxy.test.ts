import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
  createServerClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  getSupabaseServerUrl: vi.fn(),
  getSupabaseAnonKey: vi.fn(),
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mocks.updateSession,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) =>
    mocks.createServerClient(...args),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseServerUrl: () => mocks.getSupabaseServerUrl(),
  getSupabaseAnonKey: () => mocks.getSupabaseAnonKey(),
  SUPABASE_AUTH_COOKIE_NAME: "sb-test-auth-token",
}));

function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

function mockGuestSession(request: NextRequest) {
  mocks.updateSession.mockResolvedValue({
    response: NextResponse.next({ request }),
    user: null,
  });
}

function mockAuthenticatedSession(
  request: NextRequest,
  userId: string,
  role: "participant" | "organization" | "admin" = "participant",
  onboardingCompleted = true
) {
  mocks.updateSession.mockResolvedValue({
    response: NextResponse.next({ request }),
    user: {
      id: userId,
      user_metadata: {
        role,
        onboarding_completed: onboardingCompleted,
      },
    },
  });
}

describe("proxy", () => {
  beforeEach(() => {
    mocks.updateSession.mockReset();
    mocks.createServerClient.mockReset();
    mocks.from.mockReset();
    mocks.select.mockReset();
    mocks.eq.mockReset();
    mocks.maybeSingle.mockReset();
    mocks.getSupabaseServerUrl.mockReset();
    mocks.getSupabaseAnonKey.mockReset();
    mocks.getSupabaseServerUrl.mockReturnValue("https://supabase.example.com");
    mocks.getSupabaseAnonKey.mockReturnValue("anon-key");
    mocks.maybeSingle.mockResolvedValue({
      data: { is_active: true, role: "participant" },
    });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.createServerClient.mockReturnValue({ from: mocks.from });
  });

  it("未認証の未知URLはログインへ送らず404判定へ通す", async () => {
    const request = createRequest("/missing-page");
    mockGuestSession(request);

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("認証済みでもトップページは公開ページとして通過する", async () => {
    const request = createRequest("/");
    mockAuthenticatedSession(request, "missing-role-1");
    mocks.maybeSingle.mockResolvedValueOnce({ data: null });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("未認証の保護ルートはログインへリダイレクトする", async () => {
    const request = createRequest("/dashboard");
    mockGuestSession(request);

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url,
    );

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("有効な認証済みユーザーは保護ルートを通過する", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "active-1");
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { is_active: true, role: "participant" },
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.from).toHaveBeenCalledWith("m_user");
    expect(mocks.select).toHaveBeenCalledWith("is_active,role");
    expect(mocks.eq).toHaveBeenCalledWith("id", "active-1");
  });

  it("metadata role が無くても DB role があれば保護ルートを通過する", async () => {
    const request = createRequest("/mypage");
    mocks.updateSession.mockResolvedValue({
      response: NextResponse.next({ request }),
      user: {
        id: "metadata-role-missing-1",
        user_metadata: {
          onboarding_completed: true,
        },
      },
    });
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { is_active: true, role: "participant" },
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("凍結ユーザーは保護ルートで強制サインアウトされる", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "suspended-1");
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { is_active: false, role: "participant" },
    });

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url
    );

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/auth/signout");
    expect(location.searchParams.get("reason")).toBe("suspended");
  });

  it("metadata が admin でも DB が participant なら /admin への越境を拒否する", async () => {
    const request = createRequest("/admin");
    mockAuthenticatedSession(request, "participant-1", "admin");
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { is_active: true, role: "participant" },
    });

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url
    );

    expect(location.pathname).toBe("/forbidden");
  });

  it("metadata が participant でも DB が admin なら /admin を許可する", async () => {
    const request = createRequest("/admin");
    mockAuthenticatedSession(request, "admin-1", "participant");
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { is_active: true, role: "admin" },
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("DB が participant なら metadata が admin でも未完了時は participant オンボーディングへ送る", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "participant-1", "admin", false);
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { is_active: true, role: "participant" },
    });

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url
    );

    expect(location.pathname).toBe("/onboarding/participant");
  });

  it("DB が organization なら metadata が participant でも organization オンボーディングへ送る", async () => {
    const request = createRequest("/dashboard");
    mockAuthenticatedSession(request, "organization-1", "participant", false);
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { is_active: true, role: "organization" },
    });

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url
    );

    expect(location.pathname).toBe("/onboarding/organization");
  });

  it.each([
    ["取得不能", null],
    ["不正値", { is_active: true, role: "owner" }],
  ])("DB role が%sなら /admin の権限を付与しない", async (_label, account) => {
    const request = createRequest("/admin");
    mockAuthenticatedSession(request, "admin-1", "admin");
    mocks.maybeSingle.mockResolvedValueOnce({ data: account });

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url
    );

    expect(location.pathname).toBe("/forbidden");
  });

  it.each([
    ["participant", "/dashboard"],
    ["participant", "/admin"],
    ["organization", "/mypage"],
    ["organization", "/admin"],
    ["admin", "/mypage"],
    ["admin", "/dashboard"],
  ] as const)("%s は %s へ越境できない", async (role, pathname) => {
    const request = createRequest(pathname);
    mockAuthenticatedSession(request, `${role}-1`, role);
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { is_active: true, role },
    });

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url
    );

    expect(location.pathname).toBe("/forbidden");
  });
});

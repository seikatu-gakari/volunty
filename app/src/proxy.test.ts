import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";
import {
  parseForwardedViewerContext,
  VIEWER_CONTEXT_HEADER,
} from "@/lib/auth/viewer-context-header";

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

function createRequest(
  pathname: string,
  headers?: HeadersInit,
): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"), {
    headers,
  });
}

function forwardedViewerContext(response: NextResponse) {
  return parseForwardedViewerContext(
    response.headers.get(
      `x-middleware-request-${VIEWER_CONTEXT_HEADER}`,
    ),
  );
}

function mockGuestSession(request: NextRequest) {
  mocks.updateSession.mockResolvedValue({
    response: NextResponse.next({ request }),
    identity: null,
  });
}

function mockAuthenticatedSession(
  request: NextRequest,
  userId: string,
  _role: "participant" | "organization" | "admin" = "participant",
  _onboardingCompleted = true
) {
  void _role;
  void _onboardingCompleted;
  mocks.updateSession.mockResolvedValue({
    response: NextResponse.next({ request }),
    identity: {
      id: userId,
      email: `${userId}@example.com`,
      displayName: null,
    },
  });
}

function authorizationAccount(
  role: "participant" | "organization" | "admin",
  options: { isActive?: boolean; hasProfile?: boolean; reviewStatus?: string } = {},
) {
  const hasProfile = options.hasProfile ?? true;
  return {
    is_active: options.isActive ?? true,
    role,
    m_participant_profile:
      role === "participant" && hasProfile ? { id: "participant-profile-1" } : null,
    m_organization_profile:
      role === "organization" && hasProfile
        ? {
            id: "organization-profile-1",
            verified: false,
            review_status: options.reviewStatus ?? "approved",
          }
        : null,
  };
}

describe("proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      data: {
        is_active: true,
        role: "participant",
        m_participant_profile: { id: "participant-profile-1" },
        m_organization_profile: null,
      },
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

  it("認証callbackはsession lookupより前に通過する", async () => {
    const request = createRequest("/auth/callback?code=test-code");

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
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

  it("公開ページではクライアントが偽装した内部Viewerヘッダーを除去する", async () => {
    const request = createRequest("/", {
      [VIEWER_CONTEXT_HEADER]: "forged-viewer",
    });
    mockGuestSession(request);

    const response = await proxy(request);

    expect(forwardedViewerContext(response)).toBeNull();
    expect(
      response.headers.get(
        `x-middleware-request-${VIEWER_CONTEXT_HEADER}`,
      ),
    ).toBeNull();
  });

  it.each([
    "/diagnosis/trial",
    "/opportunities",
    "/opportunities?q=test",
    "/opportunities/00000000-0000-4000-8000-000000000001",
  ] as const)(
    "未認証でも %s は公開ページとして通過する",
    async (path) => {
      const request = createRequest(path);
      mockGuestSession(request);

      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["/diagnosis", "/diagnosis"],
    ["/diagnosis/result", "/diagnosis/result"],
  ] as const)("未認証の %s はログインへリダイレクトする", async (path, next) => {
    const request = createRequest(path);
    mockGuestSession(request);

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url,
    );

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(next);
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
      data: authorizationAccount("participant"),
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.from).toHaveBeenCalledWith("m_user");
    expect(mocks.select).toHaveBeenCalledWith(
      "is_active,role,m_participant_profile(id),m_organization_profile(id,verified,review_status)",
    );
    expect(mocks.eq).toHaveBeenCalledWith("id", "active-1");
    expect(forwardedViewerContext(response)).toEqual({
      identity: {
        id: "active-1",
        email: "active-1@example.com",
        displayName: null,
      },
      role: "participant",
      isActive: true,
      hasParticipantProfile: true,
      hasOrganizationProfile: false,
      organizationVerified: false,
      organizationReviewStatus: null,
    });
  });

  it("保護ルートではクライアントの偽装ヘッダーをDB検証済みViewerで上書きする", async () => {
    const request = createRequest("/mypage", {
      [VIEWER_CONTEXT_HEADER]: "forged-viewer",
    });
    mockAuthenticatedSession(request, "verified-participant-1");
    mocks.maybeSingle.mockResolvedValueOnce({
      data: authorizationAccount("participant"),
      error: null,
    });

    const response = await proxy(request);

    expect(forwardedViewerContext(response)?.identity.id).toBe(
      "verified-participant-1",
    );
  });

  it("認証更新Cookieの属性を保護ルートの応答へ引き継ぐ", async () => {
    const request = createRequest("/mypage");
    const sourceResponse = NextResponse.next({ request });
    sourceResponse.cookies.set("refreshed-session", "token", {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    mocks.updateSession.mockResolvedValue({
      response: sourceResponse,
      identity: {
        id: "cookie-participant-1",
        email: "cookie-participant-1@example.com",
        displayName: null,
      },
    });
    mocks.maybeSingle.mockResolvedValueOnce({
      data: authorizationAccount("participant"),
      error: null,
    });

    const response = await proxy(request);
    const setCookie = response.headers.get("set-cookie");

    expect(setCookie).toContain("refreshed-session=token");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Secure");
  });

  it("保護ルートは埋め込みプロフィールを含む1 client・1 queryで参加者を判定する", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "participant-array-1");
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        ...authorizationAccount("participant"),
        m_participant_profile: [{ id: "participant-profile-1" }],
      },
      error: null,
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(mocks.createServerClient).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });

  it("未承認団体は埋め込み審査状態によりpending画面へ送る", async () => {
    const request = createRequest("/dashboard");
    mockAuthenticatedSession(request, "organization-pending-1");
    mocks.maybeSingle.mockResolvedValueOnce({
      data: authorizationAccount("organization", { reviewStatus: "pending" }),
      error: null,
    });

    const response = await proxy(request);
    const location = new URL(response.headers.get("location") ?? "", request.url);

    expect(location.pathname).toBe("/onboarding/pending");
  });

  it("metadata role が無くても DB role があれば保護ルートを通過する", async () => {
    const request = createRequest("/mypage");
    mocks.updateSession.mockResolvedValue({
      response: NextResponse.next({ request }),
      identity: {
        id: "metadata-role-missing-1",
        email: "metadata-role-missing-1@example.com",
        displayName: null,
      },
    });
    mocks.maybeSingle.mockResolvedValueOnce({
      data: authorizationAccount("participant"),
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("凍結ユーザーは保護ルートで強制サインアウトされる", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "suspended-1");
    mocks.maybeSingle.mockResolvedValueOnce({
      data: authorizationAccount("participant", { isActive: false }),
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
      data: authorizationAccount("participant"),
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
      data: authorizationAccount("admin"),
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("DB が participant なら metadata が admin でもプロフィール未登録時はロール選択へ送る", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "participant-1", "admin", false);
    mocks.maybeSingle.mockResolvedValueOnce({
      data: authorizationAccount("participant", { hasProfile: false }),
    });

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url
    );

    expect(location.pathname).toBe("/onboarding/role");
  });

  it("DB が organization なら metadata が participant でもプロフィール未登録時はロール選択へ送る", async () => {
    const request = createRequest("/dashboard");
    mockAuthenticatedSession(request, "organization-1", "participant", false);
    mocks.maybeSingle.mockResolvedValueOnce({
      data: authorizationAccount("organization", { hasProfile: false }),
    });

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url
    );

    expect(location.pathname).toBe("/onboarding/role");
  });

  it("metadata完了済みでも対応プロフィールがなければロール選択へ戻す", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "participant-incomplete-1", "participant", true);
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: authorizationAccount("participant", { hasProfile: false }),
        error: null,
      });

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url,
    );

    expect(location.pathname).toBe("/onboarding/role");
  });

  it("対応プロフィールがあればmetadataにかかわらず保護ルートを通過する", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "participant-complete-1", "participant", false);
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: authorizationAccount("participant"),
        error: null,
      });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("プロフィール照会エラーは未完了と誤認せずfail closedする", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "profile-error-1", "participant");
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: { code: "42501", message: "permission denied" },
      });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url,
    );

    expect(location.pathname).toBe("/forbidden");
    expect(errorSpy).toHaveBeenCalledWith("[proxy] m_user lookup failed", {
      code: "m_user_lookup_error",
    });
  });

  it.each([
    ["取得不能", null, "m_user_role_missing"],
    ["不正値", { is_active: true, role: "owner" }, "m_user_role_invalid"],
  ] as const)("DB role が%sなら /admin の権限を付与しない", async (_label, account, expectedCode) => {
    const request = createRequest("/admin");
    mockAuthenticatedSession(request, "admin-1", "admin");
    mocks.maybeSingle.mockResolvedValueOnce({ data: account });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url
    );

    expect(location.pathname).toBe("/forbidden");
    expect(errorSpy).toHaveBeenCalledWith(
      expectedCode === "m_user_role_missing"
        ? "[proxy] m_user role missing"
        : "[proxy] m_user role invalid",
      { code: expectedCode },
    );
  });

  it("m_user の Data API エラーは metadata にフォールバックせず、PII なしで記録する", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "permission-denied-1", "participant");
    mocks.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: {
        code: "42501",
        message: "permission denied for table m_user",
      },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url,
    );

    expect(location.pathname).toBe("/forbidden");
    expect(errorSpy).toHaveBeenCalledWith("[proxy] m_user lookup failed", {
      code: "m_user_lookup_error",
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("permission-denied-1");
  });

  it("m_user の本人行が無い場合はロール未登録として記録し、拒否する", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "missing-account-1", "participant");
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url,
    );

    expect(location.pathname).toBe("/forbidden");
    expect(errorSpy).toHaveBeenCalledWith("[proxy] m_user role missing", {
      code: "m_user_role_missing",
    });
  });

  it("m_user の不正ロールは不正値として記録し、拒否する", async () => {
    const request = createRequest("/mypage");
    mockAuthenticatedSession(request, "invalid-role-1", "participant");
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { is_active: true, role: "owner" },
      error: null,
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url,
    );

    expect(location.pathname).toBe("/forbidden");
    expect(errorSpy).toHaveBeenCalledWith("[proxy] m_user role invalid", {
      code: "m_user_role_invalid",
    });
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
      data: authorizationAccount(role),
    });

    const response = await proxy(request);
    const location = new URL(
      response.headers.get("location") ?? "",
      request.url
    );

    expect(location.pathname).toBe("/forbidden");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";
import { createSignupConsentToken } from "@/lib/legal/consent-token";
import {
  LEGAL_DOCUMENT_VERSIONS,
  SIGNUP_CONSENT_COOKIE,
} from "@/lib/legal/documents";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  ensureUserRecord: vi.fn(),
  recordLegalConsent: vi.fn(),
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

vi.mock("@/lib/legal/consent", () => ({
  recordLegalConsent: mocks.recordLegalConsent,
}));

describe("auth callback route", () => {
  beforeEach(() => {
    vi.stubEnv("LEGAL_CONSENT_SECRET", "test-consent-secret");
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
      created: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it.each(["/%09/evil.example", "/%0A/evil.example", "/%0D/evil.example"])(
    "プロフィール完了済みでもC0制御文字入りnext=%sはトップへフォールバックする",
    async (next) => {
      mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });

      const response = await GET(
        new Request(
          `http://0.0.0.0:3000/auth/callback?code=ok&next=${next}`
        )
      );

      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/?toast=login-success"
      );
    }
  );

  it("新規登録のOAuth成功時だけ現行版の同意履歴を保存する", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    mocks.ensureUserRecord.mockResolvedValueOnce({
      role: "participant",
      hasParticipantProfile: false,
      hasOrganizationProfile: false,
      created: true,
    });
    const token = createSignupConsentToken();
    const request = new NextRequest("http://0.0.0.0:3000/auth/callback?code=ok");
    request.cookies.set(SIGNUP_CONSENT_COOKIE, token);
    const response = await GET(request);

    expect(mocks.recordLegalConsent).toHaveBeenCalledWith({
      userId: "user-123",
      termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
      privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
      agreedAt: expect.any(Date),
    });
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/onboarding/role?toast=login-success",
    );
  });

  it("既存ユーザーのOAuthログインでは同意履歴を追加しない", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    const token = createSignupConsentToken();
    const request = new NextRequest("http://0.0.0.0:3000/auth/callback?code=ok");
    request.cookies.set(SIGNUP_CONSENT_COOKIE, token);

    await GET(request);

    expect(mocks.recordLegalConsent).not.toHaveBeenCalled();
  });

  it("OAuth交換に失敗した場合は同意履歴を作成しない", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({
      error: { name: "AuthApiError", message: "cancelled", status: 400 },
    });
    const token = createSignupConsentToken();
    const request = new NextRequest(
      "http://0.0.0.0:3000/auth/callback?code=cancelled",
    );
    request.cookies.set(SIGNUP_CONSENT_COOKIE, token);

    await GET(request);

    expect(mocks.recordLegalConsent).not.toHaveBeenCalled();
    expect(mocks.ensureUserRecord).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mockSet }),
}));

const { prepareSignupConsent } = await import("./consent-actions");

describe("prepareSignupConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("LEGAL_CONSENT_SECRET", "test-consent-secret");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("未認証でもOAuth開始用のHttpOnly cookieを設定する", async () => {
    await expect(prepareSignupConsent()).resolves.toEqual({ success: true });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "volunty_signup_consent",
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
  });

  it("secretがない場合は開始せず利用者向けエラーを返す", async () => {
    vi.stubEnv("LEGAL_CONSENT_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    await expect(prepareSignupConsent()).resolves.toEqual({
      success: false,
      error: "登録準備に失敗しました。時間をおいて再度お試しください。",
    });
    expect(mockSet).not.toHaveBeenCalled();
  });
});

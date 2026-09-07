import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEGAL_DOCUMENT_VERSIONS,
  SIGNUP_CONSENT_MAX_AGE_SECONDS,
} from "./documents";
import {
  createSignupConsentToken,
  verifySignupConsentToken,
} from "./consent-token";

describe("signup consent token", () => {
  beforeEach(() => {
    vi.stubEnv("LEGAL_CONSENT_SECRET", "test-consent-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("現行版の署名済みtokenを検証できる", () => {
    const issuedAt = 1_000_000;
    const token = createSignupConsentToken(issuedAt);

    expect(verifySignupConsentToken(token, issuedAt + 1)).toEqual({
      termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
      privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
    });
  });

  it("tokenの改ざんを拒否する", () => {
    const token = createSignupConsentToken(1_000_000);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(verifySignupConsentToken(tampered, 1_000_001)).toBeNull();
  });

  it("有効期限切れ・未来のtokenを拒否する", () => {
    const issuedAt = 1_000_000;
    const token = createSignupConsentToken(issuedAt);

    expect(
      verifySignupConsentToken(token, issuedAt + SIGNUP_CONSENT_MAX_AGE_SECONDS + 1),
    ).toBeNull();
    expect(verifySignupConsentToken(token, issuedAt - 1)).toBeNull();
  });

  it("署名用secretがない場合はtokenを発行しない", () => {
    vi.stubEnv("LEGAL_CONSENT_SECRET", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(() => createSignupConsentToken()).toThrow(
      "LEGAL_CONSENT_SECRET または SUPABASE_SERVICE_ROLE_KEY が未設定です。",
    );
  });
});

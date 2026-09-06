import { createHmac, timingSafeEqual } from "node:crypto";
import {
  LEGAL_DOCUMENT_VERSIONS,
  SIGNUP_CONSENT_MAX_AGE_SECONDS,
} from "./documents";

interface SignupConsentPayload {
  termsVersion: string;
  privacyVersion: string;
  issuedAt: number;
}

function getConsentSecret(): string {
  const secret =
    process.env.LEGAL_CONSENT_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "LEGAL_CONSENT_SECRET または SUPABASE_SERVICE_ROLE_KEY が未設定です。"
    );
  }
  return secret;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function sign(value: string): string {
  return createHmac("sha256", getConsentSecret()).update(value).digest("base64url");
}

function isPayload(value: unknown): value is SignupConsentPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.termsVersion === "string" &&
    typeof payload.privacyVersion === "string" &&
    typeof payload.issuedAt === "number" &&
    Number.isFinite(payload.issuedAt)
  );
}

export function createSignupConsentToken(
  issuedAt = Math.floor(Date.now() / 1000)
): string {
  const payload: SignupConsentPayload = {
    termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
    privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
    issuedAt,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

/** 現行版への同意だけを受け付け、署名・有効期限・版を検証する。 */
export function verifySignupConsentToken(
  token: string | null,
  now = Math.floor(Date.now() / 1000)
): { termsVersion: string; privacyVersion: string } | null {
  if (!token) return null;

  const [encodedPayload, encodedSignature, ...rest] = token.split(".");
  if (!encodedPayload || !encodedSignature || rest.length > 0) return null;

  const expectedSignature = sign(encodedPayload);
  const actualBuffer = Buffer.from(encodedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const decodedPayload = decode(encodedPayload);
  if (!decodedPayload) return null;

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(decodedPayload);
  } catch {
    return null;
  }
  if (!isPayload(parsedPayload)) return null;

  const age = now - parsedPayload.issuedAt;
  if (age < 0 || age > SIGNUP_CONSENT_MAX_AGE_SECONDS) return null;
  if (
    parsedPayload.termsVersion !== LEGAL_DOCUMENT_VERSIONS.terms ||
    parsedPayload.privacyVersion !== LEGAL_DOCUMENT_VERSIONS.privacy
  ) {
    return null;
  }

  return {
    termsVersion: parsedPayload.termsVersion,
    privacyVersion: parsedPayload.privacyVersion,
  };
}

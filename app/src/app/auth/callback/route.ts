import { NextResponse } from "next/server";
import { ensureUserRecord } from "@/lib/auth/ensure-user-record";
import { needsRoleSelection } from "@/lib/onboarding/role";
import { createClient } from "@/lib/supabase/server";
import { recordLegalConsent } from "@/lib/legal/consent";
import { SIGNUP_CONSENT_COOKIE } from "@/lib/legal/documents";
import { verifySignupConsentToken } from "@/lib/legal/consent-token";

function normalizeOrigin(origin: string) {
  return origin.replace("//0.0.0.0:", "//localhost:");
}

function getSafeNextPath(next: string | null, origin: string) {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\") &&
    !/[\u0000-\u001f]/.test(next)
  ) {
    try {
      const resolvedNext = new URL(next, origin);
      if (resolvedNext.origin === origin) {
        return `${resolvedNext.pathname}${resolvedNext.search}${resolvedNext.hash}`;
      }
    } catch {
      // 不正な next はトップへフォールバックする。
    }
  }

  return "/";
}

function buildLoginSuccessUrl(origin: string, next: string | null) {
  const redirectUrl = new URL(getSafeNextPath(next, origin), origin);
  redirectUrl.searchParams.set("toast", "login-success");
  return redirectUrl.toString();
}

function buildRoleSelectionUrl(origin: string) {
  const redirectUrl = new URL("/onboarding/role", origin);
  redirectUrl.searchParams.set("toast", "login-success");
  return redirectUrl.toString();
}

function buildLoginErrorUrl(origin: string, reason = "auth") {
  const redirectUrl = new URL("/login", origin);
  redirectUrl.searchParams.set("error", reason);
  return redirectUrl.toString();
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;

  for (const item of cookieHeader.split(";")) {
    const separatorIndex = item.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = item.slice(0, separatorIndex).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(item.slice(separatorIndex + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

function redirectWithConsentCleared(url: string) {
  const response = NextResponse.redirect(url);
  response.cookies.delete(SIGNUP_CONSENT_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const authErrorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const consentCookie = getCookieValue(
    request.headers.get("cookie"),
    SIGNUP_CONSENT_COOKIE,
  );
  let signupConsent: ReturnType<typeof verifySignupConsentToken> = null;
  if (consentCookie) {
    try {
      signupConsent = verifySignupConsentToken(consentCookie);
    } catch (error) {
      console.error("[AuthCallback] 同意トークンの検証に失敗しました", {
        code: "consent_token_invalid",
        error,
      });
    }
  }
  // 0.0.0.0 でアクセスした場合は localhost に補正（Docker開発環境対応）
  const origin = normalizeOrigin(requestUrl.origin);

  if (authError) {
    console.error("[AuthCallback] OAuthプロバイダ認証エラー:", {
      error: authError,
      description: authErrorDescription,
    });
  }

  if (consentCookie && !signupConsent) {
    return redirectWithConsentCleared(buildLoginErrorUrl(origin, "consent"));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
        error: getUserError,
      } = await supabase.auth.getUser();

      if (getUserError || !user) {
        console.error("[AuthCallback] ユーザー取得エラー:", getUserError);
        return redirectWithConsentCleared(buildLoginErrorUrl(origin, "user-sync"));
      }

      try {
        const onboardingState = await ensureUserRecord(user);
        if (onboardingState.created && signupConsent) {
          await recordLegalConsent({
            userId: user.id,
            termsVersion: signupConsent.termsVersion,
            privacyVersion: signupConsent.privacyVersion,
            agreedAt: new Date(),
          });
        }
        if (needsRoleSelection(onboardingState)) {
          return redirectWithConsentCleared(buildRoleSelectionUrl(origin));
        }
      } catch (err) {
        console.error("[AuthCallback] m_user同期エラー:", err);
        return redirectWithConsentCleared(buildLoginErrorUrl(origin, "user-sync"));
      }

      return redirectWithConsentCleared(buildLoginSuccessUrl(origin, next));
    }

    console.error("[AuthCallback] セッション交換エラー:", {
      name: error.name,
      message: error.message,
      status: error.status,
    });
  }

  // 認証エラー時はログインページにリダイレクト
  return redirectWithConsentCleared(buildLoginErrorUrl(origin));
}

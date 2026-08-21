import { NextResponse } from "next/server";
import { ensureUserRecord } from "@/lib/auth/ensure-user-record";
import { needsRoleSelection } from "@/lib/onboarding/role";
import { createClient } from "@/lib/supabase/server";

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const authErrorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next") ?? "/";
  // 0.0.0.0 でアクセスした場合は localhost に補正（Docker開発環境対応）
  const origin = normalizeOrigin(requestUrl.origin);

  if (authError) {
    console.error("[AuthCallback] OAuthプロバイダ認証エラー:", {
      error: authError,
      description: authErrorDescription,
    });
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
        return NextResponse.redirect(buildLoginErrorUrl(origin, "user-sync"));
      }

      try {
        const onboardingState = await ensureUserRecord(user);
        if (needsRoleSelection(onboardingState)) {
          return NextResponse.redirect(buildRoleSelectionUrl(origin));
        }
      } catch (err) {
        console.error("[AuthCallback] m_user同期エラー:", err);
        return NextResponse.redirect(buildLoginErrorUrl(origin, "user-sync"));
      }

      return NextResponse.redirect(buildLoginSuccessUrl(origin, next));
    }

    console.error("[AuthCallback] セッション交換エラー:", {
      name: error.name,
      message: error.message,
      status: error.status,
    });
  }

  // 認証エラー時はログインページにリダイレクト
  return NextResponse.redirect(buildLoginErrorUrl(origin));
}

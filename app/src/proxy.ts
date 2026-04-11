import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// ============================================
// ルート分類
// ============================================

/** 認証チェックを完全にスキップするパス */
const AUTH_CALLBACK = "/auth/callback";

/** パブリックルート（認証不要、リダイレクトなし） */
const PUBLIC_PATHS = new Set(["/"]);

/** 認証系パス（ログイン済みなら / へリダイレクト） */
function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/signup");
}

/** オンボーディングパス（認証必須だがプロフィールチェック不要） */
function isOnboardingPath(pathname: string): boolean {
  return pathname.startsWith("/onboarding");
}

/** セッション Cookie をリダイレクトレスポンスにコピー */
function redirectWithCookies(
  url: URL,
  sourceResponse: NextResponse
): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value);
  });
  return redirectResponse;
}

// ============================================
// プロキシ本体
// ============================================

export async function proxy(request: NextRequest) {
  // Supabase セッション更新 + ユーザー情報取得
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // --- 認証コールバック: 常にスルー ---
  if (pathname.startsWith(AUTH_CALLBACK)) {
    return response;
  }

  // --- 認証系（/login, /signup/*）: ログイン済みなら / へ ---
  if (isAuthPath(pathname)) {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return redirectWithCookies(url, response);
    }
    return response;
  }

  // --- パブリック（/）: 常にスルー ---
  if (PUBLIC_PATHS.has(pathname)) {
    return response;
  }

  // --- 以下は認証必須 ---
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return redirectWithCookies(url, response);
  }

  // --- オンボーディングパス: 認証済みならスルー ---
  if (isOnboardingPath(pathname)) {
    return response;
  }

  // --- 保護ルート: ロール・オンボーディング状態チェック ---
  const metadata = user.user_metadata as Record<string, unknown>;
  const role = metadata.role as string | undefined;

  // ロール未選択 → /onboarding/role
  if (!role) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding/role";
    return redirectWithCookies(url, response);
  }

  // オンボーディング未完了 → /onboarding/{role}
  if (!metadata.onboarding_completed) {
    const url = request.nextUrl.clone();
    url.pathname =
      role === "organization"
        ? "/onboarding/organization"
        : "/onboarding/participant";
    return redirectWithCookies(url, response);
  }

  // 未承認団体: /onboarding/pending 以外へのアクセスをブロック
  if (role === "organization" && pathname !== "/onboarding/pending") {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: () => {},
          },
        });
        const { data: profile } = await supabase
          .from("m_organization_profile")
          .select("verified")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile && !profile.verified) {
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding/pending";
          return redirectWithCookies(url, response);
        }
      } catch {
        // DB クエリ失敗時はスルー
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

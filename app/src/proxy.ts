import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  getSupabaseAnonKey,
  getSupabaseServerUrl,
  SUPABASE_AUTH_COOKIE_NAME,
} from "@/lib/supabase/env";

// ============================================
// ルート分類
// ============================================

/** 認証チェックを完全にスキップするパス */
const AUTH_CALLBACK = "/auth/callback";

/** パブリックルート（認証不要、リダイレクトなし） */
const PUBLIC_PATHS = new Set(["/"]);

/** 認証必須ルートの prefix */
const PROTECTED_PATH_PREFIXES = [
  "/admin",
  "/dashboard",
  "/diagnosis",
  "/mypage",
  "/onboarding",
  "/opportunities",
  "/organizations",
  "/recommendations",
];

/** 認証系パス（ログイン済みなら / へリダイレクト） */
function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/signup");
}

/** 認証必須ルートかどうか */
function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
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

  // --- パブリック（/）: 未認証ならスルー、認証済みならロール/オンボーディングチェックを実施 ---
  const isPublicPath = PUBLIC_PATHS.has(pathname);
  if (isPublicPath) {
    if (!user) {
      return response;
    }
    // 認証済みユーザーは下のロール・オンボーディングチェックに進む
  }

  // --- 保護対象外の未知URLなどは Next.js の 404 判定へ通す ---
  if (!isPublicPath && !isProtectedPath(pathname)) {
    return response;
  }

  // --- 以下は認証必須 ---
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return redirectWithCookies(url, response);
  }

  // --- 凍結チェック: is_active=false なら強制サインアウト ---
  {
    const supabaseUrl = getSupabaseServerUrl();
    const supabaseAnonKey = getSupabaseAnonKey();
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookieOptions: {
            name: SUPABASE_AUTH_COOKIE_NAME,
          },
          cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (cookiesToSet) => {
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              );
            },
          },
        });
        const { data: account } = await supabase
          .from("m_user")
          .select("is_active")
          .eq("id", user.id)
          .maybeSingle();
        if (account && account.is_active === false) {
          const url = request.nextUrl.clone();
          url.pathname = "/auth/signout";
          url.search = "";
          url.searchParams.set("reason", "suspended");
          return redirectWithCookies(url, response);
        }
      } catch (err) {
        console.error("[proxy] 凍結チェックに失敗:", err);
      }
    }
  }

  // --- オンボーディングパス: 認証済みならスルー ---
  if (isOnboardingPath(pathname)) {
    return response;
  }

  // --- 保護ルート: ロール・オンボーディング状態チェック ---
  const metadata = user.user_metadata as Record<string, unknown>;
  const role = metadata.role as string | undefined;

  // 管理者: トップアクセス時は管理ダッシュボードへ。onboarding/verified チェックはスキップ
  if (role === "admin") {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/organizations";
      return redirectWithCookies(url, response);
    }
    return response;
  }

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
    const supabaseUrl = getSupabaseServerUrl();
    const supabaseAnonKey = getSupabaseAnonKey();
    if (supabaseUrl && supabaseAnonKey) {
      try {
        // updateSession 後の更新済みクッキーを使い、verified フラグ確認用クライアントを生成する
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookieOptions: {
            name: SUPABASE_AUTH_COOKIE_NAME,
          },
          cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (cookiesToSet) => {
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              );
            },
          },
        });
        const { data: profile } = await supabase
          .from("m_organization_profile")
          .select("verified,review_status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile && profile.review_status !== "approved") {
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding/pending";
          return redirectWithCookies(url, response);
        }
      } catch (err) {
        // DB クエリ失敗時はスルー（可用性を優先し、ページ側でも検証する）
        console.error("[proxy] 団体の verified チェックに失敗:", err);
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

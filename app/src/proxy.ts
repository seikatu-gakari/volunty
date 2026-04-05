import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// ============================================
// ルート分類
// ============================================

/** 認証不要なパブリックルート */
const PUBLIC_PATHS = new Set(["/", "/login", "/auth/callback"]);

/** サインアップフロー（認証不要だが、ログイン済みならリダイレクト） */
const SIGNUP_PREFIX = "/signup";

/** ログイン済みユーザーがアクセスした場合にリダイレクトする認証系パス */
function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith(SIGNUP_PREFIX);
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith(SIGNUP_PREFIX);
}

// ============================================
// プロキシ本体
// ============================================

export async function proxy(request: NextRequest) {
  // Supabase セッション更新 + ユーザー情報取得
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // --- パブリックルート ---
  if (isPublicPath(pathname)) {
    // ログイン済みユーザーが認証系ページにアクセスした場合はホームへリダイレクト
    if (user && isAuthPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // --- 保護ルート: 未認証 → /login へリダイレクト ---
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // ログイン後に元のページへ戻れるよう、リダイレクト先を保存
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

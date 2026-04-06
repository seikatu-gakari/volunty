import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import type { UserRole } from "@/lib/onboarding/types";

// ============================================
// ルート分類
// ============================================

/** 認証不要なパブリックルート */
const PUBLIC_PATHS = new Set(["/", "/login", "/auth/callback"]);

/** サインアップフロー（認証不要だが、ログイン済みならリダイレクト） */
const SIGNUP_PREFIX = "/signup";

/** オンボーディングフロー（認証済みだが、プロフィール未登録ユーザー用） */
const ONBOARDING_PREFIX = "/onboarding";

/** ログイン済みユーザーがアクセスした場合にリダイレクトする認証系パス */
function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith(SIGNUP_PREFIX);
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith(SIGNUP_PREFIX);
}

function isOnboardingPath(pathname: string): boolean {
  return pathname.startsWith(ONBOARDING_PREFIX);
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

  // --- オンボーディングルート: 認証済みユーザーはアクセス可能 ---
  // 各ページで個別の状態チェック・リダイレクトを行う
  if (isOnboardingPath(pathname)) {
    return response;
  }

  // --- 認証済みユーザーのオンボーディング状態チェック ---
  // 団体ユーザーの未承認状態を強制的に /onboarding/pending へリダイレクト
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // ミドルウェア内での読み取り専用（レスポンスは updateSession が管理）
          },
        },
      });

      // users テーブルからロールを取得
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = userData?.role as UserRole | undefined;

      if (!role) {
        // ロール未設定 → ロール選択へリダイレクト
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding/role";
        return NextResponse.redirect(url);
      }

      if (role === "participant") {
        // 参加者プロフィール未登録チェック
        const { data: profile } = await supabase
          .from("participants")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!profile) {
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding/participant";
          return NextResponse.redirect(url);
        }
      }

      if (role === "organization") {
        // 団体プロフィール未登録・未承認チェック
        const { data: org } = await supabase
          .from("organizations")
          .select("id, status")
          .eq("id", user.id)
          .single();

        if (!org) {
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding/organization";
          return NextResponse.redirect(url);
        }

        if (org.status !== "approved") {
          // 未承認団体は /onboarding/pending 以外へのアクセスをブロック
          const url = request.nextUrl.clone();
          url.pathname = "/onboarding/pending";
          return NextResponse.redirect(url);
        }
      }
    }
  } catch {
    // DB エラー時はアクセスを許可（グレースフルデグラデーション）
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

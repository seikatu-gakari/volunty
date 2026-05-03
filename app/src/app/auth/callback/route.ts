import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const authErrorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next") ?? "/";
  // 0.0.0.0 でアクセスした場合は localhost に補正（Docker開発環境対応）
  const origin = requestUrl.origin.replace("//0.0.0.0:", "//localhost:");

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
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[AuthCallback] セッション交換エラー:", {
      name: error.name,
      message: error.message,
      status: error.status,
    });
  }

  // 認証エラー時はログインページにリダイレクト
  return NextResponse.redirect(`${origin}/login?error=auth`);
}

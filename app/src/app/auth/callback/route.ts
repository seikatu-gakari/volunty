import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  // 0.0.0.0 でアクセスした場合は localhost に補正（Docker開発環境対応）
  const origin = requestUrl.origin.replace("//0.0.0.0:", "//localhost:");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 認証エラー時はログインページにリダイレクト
  return NextResponse.redirect(`${origin}/login?error=auth`);
}

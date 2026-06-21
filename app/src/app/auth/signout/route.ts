import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** 凍結ユーザーなどを強制サインアウトしてログインへ戻す */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const reason = requestUrl.searchParams.get("reason");
  const origin = requestUrl.origin.replace("//0.0.0.0:", "//localhost:");

  const supabase = await createClient();
  await supabase.auth.signOut();

  const loginUrl = new URL("/login", origin);
  if (reason === "suspended") {
    loginUrl.searchParams.set("error", "suspended");
  }

  return NextResponse.redirect(loginUrl.toString());
}

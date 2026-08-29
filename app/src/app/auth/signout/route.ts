import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** セッションを削除し、目的に応じた固定URLへ遷移する */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const reason = requestUrl.searchParams.get("reason");
  const intent = requestUrl.searchParams.get("intent");
  const origin = requestUrl.origin.replace("//0.0.0.0:", "//localhost:");

  const supabase = await createClient();
  await supabase.auth.signOut();

  if (reason === "suspended") {
    return NextResponse.redirect(
      new URL("/login?error=suspended", origin).toString(),
    );
  }

  if (reason === null && intent === "switch-account") {
    return NextResponse.redirect(new URL("/login", origin).toString());
  }

  return NextResponse.redirect(new URL("/", origin).toString());
}

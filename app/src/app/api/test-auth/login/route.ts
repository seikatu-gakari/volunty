import { NextResponse } from "next/server";

import { ensureUserRecord } from "@/lib/auth/ensure-user-record";
import { createClient } from "@/lib/supabase/server";
import { resolvePersona } from "@/lib/test-auth/personas";

function isTestAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_AUTH_ENABLED === "true"
  );
}

function normalizeOrigin(origin: string): string {
  return origin.replace("//0.0.0.0:", "//localhost:");
}

function getSafeNextPath(rawNext: string | null): string {
  if (
    rawNext &&
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.includes("\\")
  ) {
    return rawNext;
  }

  return "/";
}

export async function GET(request: Request) {
  if (!isTestAuthEnabled()) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const personaKey = requestUrl.searchParams.get("persona");

  if (!personaKey) {
    return NextResponse.json(
      { error: "persona パラメータが必要です" },
      { status: 400 }
    );
  }

  const persona = resolvePersona(personaKey);
  if (!persona) {
    return NextResponse.json(
      { error: `不明な persona: ${personaKey}` },
      { status: 400 }
    );
  }

  const password = process.env.E2E_TEST_USER_PASSWORD;
  if (!password) {
    console.error("[TestAuth] E2E_TEST_USER_PASSWORD が未設定です");
    return NextResponse.json(
      { error: "サーバー設定エラー" },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: persona.email,
    password,
  });

  if (error || !data.user) {
    console.error("[TestAuth] signInWithPassword 失敗:", error);
    return NextResponse.json(
      { error: "認証失敗", detail: error?.message },
      { status: 401 }
    );
  }

  try {
    await ensureUserRecord(data.user, { role: persona.role });
  } catch (error: unknown) {
    console.error("[TestAuth] ensureUserRecord 失敗:", error);
    return NextResponse.json(
      { error: "ユーザーレコード同期失敗" },
      { status: 500 }
    );
  }

  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(nextPath, normalizeOrigin(requestUrl.origin)), {
    status: 302,
  });
}

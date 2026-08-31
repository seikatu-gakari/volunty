import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { ViewerIdentity } from "@/lib/auth/viewer-context";
import {
  getSupabaseAnonKey,
  getSupabaseServerUrl,
  SUPABASE_AUTH_COOKIE_NAME,
} from "@/lib/supabase/env";

/** updateSession の戻り値 */
export interface SessionResult {
  response: NextResponse;
  identity: ViewerIdentity | null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function identityFromClaims(claims: unknown): ViewerIdentity | null {
  if (typeof claims !== "object" || claims === null || Array.isArray(claims)) {
    return null;
  }

  const claimRecord = claims as Record<string, unknown>;
  const id = asNonEmptyString(claimRecord.sub);
  if (!id) {
    return null;
  }

  const metadata =
    typeof claimRecord.user_metadata === "object" &&
    claimRecord.user_metadata !== null &&
    !Array.isArray(claimRecord.user_metadata)
      ? (claimRecord.user_metadata as Record<string, unknown>)
      : {};

  return {
    id,
    email: asNonEmptyString(claimRecord.email),
    displayName: asNonEmptyString(metadata.full_name),
  };
}

export async function updateSession(
  request: NextRequest
): Promise<SessionResult> {
  const supabaseUrl = getSupabaseServerUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  // Supabase 未設定時はセッション処理をスキップ（開発環境対応）
  if (!supabaseUrl || !supabaseAnonKey) {
    return { response: NextResponse.next({ request }), identity: null };
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      name: SUPABASE_AUTH_COOKIE_NAME,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // セッションの更新 + 検証済みclaimsから最小identityを取得
  const { data, error } = await supabase.auth.getClaims();

  return {
    response: supabaseResponse,
    identity: error ? null : identityFromClaims(data?.claims),
  };
}

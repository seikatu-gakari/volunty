import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "@/lib/supabase/env";

/** Supabase Admin API 用クライアントを作成する。 */
export function createAdminClient() {
  const supabaseUrl = getSupabaseServerUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase管理用環境変数が未設定です。NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。"
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

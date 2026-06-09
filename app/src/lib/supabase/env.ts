/** ブラウザ側とサーバー側で共通利用する Supabase Auth Cookie 名。 */
export const SUPABASE_AUTH_COOKIE_NAME = "sb-volunty-auth-token";

/**
 * サーバー実行時に Supabase へ接続する URL を返す。
 * Docker コンテナ内の 127.0.0.1 はコンテナ自身を指すため、必要に応じて
 * SUPABASE_INTERNAL_URL でコンテナから到達できる URL を指定する。
 */
export function getSupabaseServerUrl() {
  return process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Supabase anon key を返す。 */
export function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

/** Supabase Admin API 用 service role key を返す。 */
export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

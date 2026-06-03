// 管理者アカウント作成 / 昇格スクリプト
//
// 使い方:
//   cd app && npx tsx scripts/promote-admin.ts <email> [password]
//   または:  make promote-admin EMAIL=you@example.com [PASSWORD=secret]
//
// 動作:
//   - 指定メールのユーザーが auth.users に存在しなければ新規作成（パスワード認証 + 確認済み）
//   - 既に存在すれば、パスワード（指定時）とメタデータを更新
//   - user_metadata に role=admin / onboarding_completed=true を付与
//   - public.m_user.role を 'admin' に upsert
//
// 必須環境変数 (app/.env.local もしくはシェル環境変数に設定):
//   DATABASE_URL              ... Postgres 接続文字列
//   SUPABASE_URL              ... 例: http://127.0.0.1:54321 (未設定なら NEXT_PUBLIC_SUPABASE_URL を使用)
//   SUPABASE_SERVICE_ROLE_KEY ... `supabase status` の Service role key
import nextEnv from "@next/env";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

// Next.js 本体と同じ優先順位で環境変数を読む。
// process.env > .env.development.local > .env.local > .env.development > .env
nextEnv.loadEnvConfig(process.cwd());

const DEFAULT_PASSWORD = "AdminPass1234!";

async function main() {
  const email = process.argv[2]?.trim();
  const password = process.argv[3]?.trim() || DEFAULT_PASSWORD;
  if (!email) {
    console.error("使い方: tsx scripts/promote-admin.ts <email> [password]");
    process.exit(1);
  }

  const supabaseUrl =
    process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const databaseUrl = process.env["DATABASE_URL"];

  if (!supabaseUrl) {
    console.error(
      "SUPABASE_URL (または NEXT_PUBLIC_SUPABASE_URL) が設定されていません"
    );
    process.exit(1);
  }
  if (!serviceRoleKey) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY が設定されていません。\n" +
        "ローカルの場合は `supabase status` で 'service_role key' を確認して .env に追記してください。"
    );
    process.exit(1);
  }
  if (!databaseUrl) {
    console.error("DATABASE_URL が設定されていません");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. 既存ユーザー検索（admin.listUsers はページネーション）
  let existingUserId: string | null = null;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error("[error] listUsers:", error.message);
      process.exit(1);
    }
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (hit) {
      existingUserId = hit.id;
      break;
    }
    if (data.users.length < 200) break;
  }

  const metadata = { role: "admin", onboarding_completed: true };
  let userId: string;

  if (existingUserId) {
    const { data, error } = await admin.auth.admin.updateUserById(
      existingUserId,
      {
        password,
        email_confirm: true,
        user_metadata: metadata,
      }
    );
    if (error || !data.user) {
      console.error("[error] updateUserById:", error?.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`[update] 既存ユーザーを更新しました: ${email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error || !data.user) {
      console.error("[error] createUser:", error?.message);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`[create] 新規ユーザーを作成しました: ${email}`);
  }

  // 2. m_user を upsert（auth トリガーが既に作っているはずだが、role を確実に admin にする）
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO public.m_user (id, email, role, created_at, updated_at)
         VALUES ($1, $2, 'admin', NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
         SET role = 'admin', email = EXCLUDED.email, updated_at = NOW()`,
      [userId, email]
    );
  } finally {
    await client.end();
  }

  console.log("");
  console.log("=== 完了 ===");
  console.log(`email    : ${email}`);
  console.log(`password : ${password}`);
  console.log(`user_id  : ${userId}`);
  console.log("ログイン後に /admin/organizations へ自動遷移します。");
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});

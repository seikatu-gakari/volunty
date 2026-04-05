// Prisma 設定ファイル — Supabase PostgreSQL 接続
// Prisma 7 では prisma.config.ts の datasource.url がマイグレーション・スキーマ操作に使用される
// Supabase の Session Mode Pooler（ポート 5432）を使用する
// ※ Transaction Pooler（ポート 6543）は PgBouncer のため advisory lock 非対応でハングする
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Supabase Session Mode Pooler（ポート 5432）— マイグレーション・スキーマ操作用
    url: process.env["DIRECT_URL"]!,
  },
});

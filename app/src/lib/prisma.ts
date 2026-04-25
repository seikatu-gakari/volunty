// Prisma クライアント シングルトン（遅延初期化）
// Next.js の開発環境ではホットリロード時にクライアントが重複生成されるのを防ぐ
// Prisma 7 では driver adapter が必須
// PgBouncer（Supabase Transaction Pooler）互換のため pg.Pool を手動作成する
// Proxy で遅延初期化: モジュール読み込み時には PrismaClient を生成しない。
// Vercel ビルドの "Collecting page data" フェーズでは DATABASE_URL が
// 未設定の場合があるため、初回アクセスまで接続を遅延させる。
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const rawUrl = process.env["DATABASE_URL"];
  if (!rawUrl) {
    throw new Error(
      "DATABASE_URL 環境変数が未設定です。.env.local ファイルを確認してください"
    );
  }

  // pg ライブラリは ?pgbouncer=true を認識しないため除去する
  const url = new URL(rawUrl);
  url.searchParams.delete("pgbouncer");
  const connectionString = url.toString();

  const pool = new pg.Pool({
    connectionString,
    // Supabase Pooler は SSL 接続を要求する（ローカル環境では不要なので条件付き）
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/**
 * Proxy による遅延初期化。
 * `prisma.xxx` に初めてアクセスした時点で PrismaClient が生成される。
 * Node.js はシングルスレッドのため、同期的な createPrismaClient() が
 * 中断されることはなく、同時実行での重複生成は発生しない。
 */
function getOrCreateClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getOrCreateClient(), prop);
  },
});

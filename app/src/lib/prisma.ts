// Prisma クライアント シングルトン（遅延初期化）
// Next.js の開発環境ではホットリロード時にクライアントが重複生成されるのを防ぐ
// Prisma 7 では driver adapter が必須
// PgBouncer（Supabase Transaction Pooler）互換のため pg.Pool を手動作成する
// Proxy で遅延初期化し、ビルド時（DATABASE_URL 未設定）のエラーを防止
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL 環境変数が未設定です。.env.local ファイルを確認してください"
    );
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

// モジュールスコープのキャッシュ（本番環境用）
let cachedClient: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (cachedClient) return cachedClient;

  // 開発環境: globalThis キャッシュ（HMR でモジュール再読み込みされても同一インスタンスを維持）
  if (globalForPrisma.prisma) {
    cachedClient = globalForPrisma.prisma;
    return cachedClient;
  }

  cachedClient = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = cachedClient;
  }

  return cachedClient;
}

// 遅延初期化プロキシ — ビルド時にモジュール読み込みだけでエラーになるのを防止
// プロパティアクセス時に初めて PrismaClient を生成する
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

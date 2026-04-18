// Prisma クライアント シングルトン
// Next.js の開発環境ではホットリロード時にクライアントが重複生成されるのを防ぐ
// Prisma 7 では driver adapter が必須
//
// Proxy で遅延初期化: モジュール読み込み時には PrismaClient を生成しない。
// Vercel ビルドの "Collecting page data" フェーズでは DATABASE_URL が
// 未設定の場合があるため、初回アクセスまで接続を遅延させる。
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error(
      "[prisma] DATABASE_URL が設定されていません。" +
        "Vercel の Environment Variables または .env ファイルを確認してください。"
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Proxy による遅延初期化。
 * `prisma.xxx` に初めてアクセスした時点で PrismaClient が生成される。
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return Reflect.get(globalForPrisma.prisma, prop);
  },
});

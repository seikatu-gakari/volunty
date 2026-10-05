import "server-only";
import { prisma } from "@/lib/prisma";

export const WAITLIST_WINDOW_MS = 15 * 60 * 1000;
export const WAITLIST_IP_LIMIT = 10;

/** 複数インスタンス間でも同じDBで原子的に送信回数を制限する。 */
export async function registerWaitlist(email: string, clientHash: string): Promise<"accepted" | "limited"> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / WAITLIST_WINDOW_MS) * WAITLIST_WINDOW_MS);
    const expiresAt = new Date(windowStart.getTime() + WAITLIST_WINDOW_MS);
    await tx.waitlistRateLimit.deleteMany({ where: { expiresAt: { lte: now } } });
    const counters = await tx.$queryRaw<{ count: number }[]>`
      INSERT INTO public.t_waitlist_rate_limit (key, window_start, expires_at, count)
      VALUES (${clientHash}, ${windowStart}, ${expiresAt}, 1)
      ON CONFLICT (key, window_start) DO UPDATE
        SET count = public.t_waitlist_rate_limit.count + 1
        WHERE public.t_waitlist_rate_limit.count < ${WAITLIST_IP_LIMIT}
      RETURNING count
    `;
    if (counters.length === 0) return "limited";
    // 既存メールの有無を応答に出さず、再登録でも元の登録日時を維持する。
    await tx.waitlistEntry.createMany({ data: [{ email }], skipDuplicates: true });
    return "accepted";
  });
}

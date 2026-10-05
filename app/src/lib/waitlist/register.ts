import "server-only";
import { prisma } from "@/lib/prisma";

/** 重複時も登録日時・案内日時を変更せず、同じ成功結果を返す。 */
export async function registerWaitlist(email: string): Promise<void> {
  await prisma.waitlistEntry.createMany({ data: [{ email }], skipDuplicates: true });
}

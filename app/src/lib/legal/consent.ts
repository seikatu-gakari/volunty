import { prisma } from "@/lib/prisma";

export interface LegalConsentInput {
  userId: string;
  termsVersion: string;
  privacyVersion: string;
  agreedAt: Date;
}

/** 同じ版の同意を再受信しても1件に保つ。版が変われば新しい履歴を作る。 */
export async function recordLegalConsent(input: LegalConsentInput) {
  return prisma.legalConsent.upsert({
    where: {
      userId_termsVersion_privacyVersion: {
        userId: input.userId,
        termsVersion: input.termsVersion,
        privacyVersion: input.privacyVersion,
      },
    },
    create: input,
    update: {},
  });
}

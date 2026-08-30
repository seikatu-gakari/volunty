import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const ACCOUNT_DELETION_ERROR_CODES = {
  authDeleteFailed: "auth_delete_failed",
  dataCleanupFailed: "data_cleanup_failed",
} as const;

export type AccountDeletionResult =
  | { status: "completed" }
  | { status: "auth_failed" }
  | { status: "cleanup_pending" };

function isNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown };
  return candidate.status === 404 || candidate.code === "user_not_found";
}

function logPending(requestId: string, phase: string, errorCode: string) {
  console.error(
    JSON.stringify({
      event: "account_deletion_pending",
      requestId,
      phase,
      errorCode,
    })
  );
}

async function recordFailure(
  userId: string,
  requestId: string,
  phase: string,
  errorCode: string
) {
  try {
    const result = await prisma.accountDeletionRequest.updateMany({
      where: { userId },
      data: { lastErrorCode: errorCode },
    });
    return result.count > 0;
  } finally {
    logPending(requestId, phase, errorCode);
  }
}

/** Auth の不存在を確認してから業務データを物理削除する冪等 saga。 */
export async function processAccountDeletion(
  userId: string
): Promise<AccountDeletionResult> {
  const request = await prisma.accountDeletionRequest.upsert({
    where: { userId },
    create: { userId, attemptCount: 1 },
    update: {
      attemptCount: { increment: 1 },
      lastErrorCode: null,
    },
    select: { id: true, authDeletedAt: true },
  });

  let authDeleted = request.authDeletedAt !== null;
  if (!authDeleted) {
    let adminClient: ReturnType<typeof createAdminClient>;
    try {
      adminClient = createAdminClient();
    } catch {
      await recordFailure(
        userId,
        request.id,
        "auth_client",
        ACCOUNT_DELETION_ERROR_CODES.authDeleteFailed
      );
      return { status: "auth_failed" };
    }

    let lookup: Awaited<
      ReturnType<typeof adminClient.auth.admin.getUserById>
    >;
    try {
      lookup = await adminClient.auth.admin.getUserById(userId);
    } catch {
      await recordFailure(
        userId,
        request.id,
        "auth_lookup",
        ACCOUNT_DELETION_ERROR_CODES.authDeleteFailed
      );
      return { status: "auth_failed" };
    }
    if (lookup.error && !isNotFoundError(lookup.error)) {
      await recordFailure(
        userId,
        request.id,
        "auth_lookup",
        ACCOUNT_DELETION_ERROR_CODES.authDeleteFailed
      );
      return { status: "auth_failed" };
    }

    if (lookup.data.user) {
      let deletionFailed = false;
      try {
        const deletion = await adminClient.auth.admin.deleteUser(userId, false);
        deletionFailed = deletion.error !== null;
      } catch {
        deletionFailed = true;
      }
      if (deletionFailed) {
        let verification: Awaited<
          ReturnType<typeof adminClient.auth.admin.getUserById>
        >;
        try {
          verification = await adminClient.auth.admin.getUserById(userId);
        } catch {
          await recordFailure(
            userId,
            request.id,
            "auth_verify",
            ACCOUNT_DELETION_ERROR_CODES.authDeleteFailed
          );
          return { status: "auth_failed" };
        }
        if (verification.data.user || !isNotFoundError(verification.error)) {
          await recordFailure(
            userId,
            request.id,
            "auth_delete",
            ACCOUNT_DELETION_ERROR_CODES.authDeleteFailed
          );
          return { status: "auth_failed" };
        }
      } else {
        let verification: Awaited<
          ReturnType<typeof adminClient.auth.admin.getUserById>
        >;
        try {
          verification = await adminClient.auth.admin.getUserById(userId);
        } catch {
          await recordFailure(
            userId,
            request.id,
            "auth_verify",
            ACCOUNT_DELETION_ERROR_CODES.authDeleteFailed
          );
          return { status: "auth_failed" };
        }
        if (verification.data.user || !isNotFoundError(verification.error)) {
          await recordFailure(
            userId,
            request.id,
            "auth_verify",
            ACCOUNT_DELETION_ERROR_CODES.authDeleteFailed
          );
          return { status: "auth_failed" };
        }
      }
    }

    const authStateUpdate = await prisma.accountDeletionRequest.updateMany({
      where: { userId },
      data: { authDeletedAt: new Date(), lastErrorCode: null },
    });
    if (authStateUpdate.count === 0) {
      return { status: "completed" };
    }
    authDeleted = true;
  }

  if (!authDeleted) return { status: "auth_failed" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.deleteMany({ where: { id: userId } });
      await tx.accountDeletionRequest.deleteMany({ where: { userId } });
    });
    return { status: "completed" };
  } catch {
    const recorded = await recordFailure(
      userId,
      request.id,
      "data_cleanup",
      ACCOUNT_DELETION_ERROR_CODES.dataCleanupFailed
    );
    return recorded ? { status: "cleanup_pending" } : { status: "completed" };
  }
}

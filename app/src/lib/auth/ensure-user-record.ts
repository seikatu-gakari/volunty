import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { OnboardingProfileState } from "@/lib/onboarding/role";

type EnsureUserRecordOptions = {
  role?: UserRole;
  updateRole?: boolean;
};

export type EnsureUserRecordResult = OnboardingProfileState & {
  /** このcallbackで m_user を新規作成したか。既存ログインへの同意記録を防ぐ。 */
  created: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringMetadata(
  metadata: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function ensureUserRecord(
  user: SupabaseUser,
  options: EnsureUserRecordOptions = {}
): Promise<EnsureUserRecordResult> {
  const metadata = isRecord(user.user_metadata) ? user.user_metadata : {};
  const name = readStringMetadata(metadata, ["full_name", "name", "display_name"]);
  const avatarUrl = readStringMetadata(metadata, ["avatar_url", "picture"]);
  const lastLoginAt = new Date();

  const select = {
    role: true,
    participantProfile: { select: { id: true } },
    organizationProfile: { select: { id: true } },
  } as const;
  const update = {
    email: user.email ?? null,
    ...(name !== null ? { name } : {}),
    ...(avatarUrl !== null ? { avatarUrl } : {}),
    lastLoginAt,
    ...(options.updateRole && options.role ? { role: options.role } : {}),
  };

  let record;
  let created = false;
  try {
    record = await prisma.user.create({
      data: {
        id: user.id,
        ...update,
        ...(options.role ? { role: options.role } : {}),
      },
      select,
    });
    created = true;
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    record = await prisma.user.update({
      where: { id: user.id },
      data: update,
      select,
    });
  }

  return {
    role: record.role,
    hasParticipantProfile: record.participantProfile !== null,
    hasOrganizationProfile: record.organizationProfile !== null,
    created,
  };
}

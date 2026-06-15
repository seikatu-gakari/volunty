import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type EnsureUserRecordOptions = {
  role?: UserRole;
  updateRole?: boolean;
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

export async function ensureUserRecord(
  user: SupabaseUser,
  options: EnsureUserRecordOptions = {}
): Promise<void> {
  const metadata = isRecord(user.user_metadata) ? user.user_metadata : {};
  const name = readStringMetadata(metadata, ["full_name", "name", "display_name"]);
  const avatarUrl = readStringMetadata(metadata, ["avatar_url", "picture"]);
  const lastLoginAt = new Date();

  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email ?? null,
      ...(name !== null ? { name } : {}),
      ...(avatarUrl !== null ? { avatarUrl } : {}),
      lastLoginAt,
      ...(options.updateRole && options.role ? { role: options.role } : {}),
    },
    create: {
      id: user.id,
      email: user.email ?? null,
      name,
      avatarUrl,
      lastLoginAt,
      ...(options.role ? { role: options.role } : {}),
    },
  });
}

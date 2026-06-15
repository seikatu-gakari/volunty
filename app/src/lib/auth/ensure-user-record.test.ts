import type { User as SupabaseUser } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrismaUserUpsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      upsert: (...args: unknown[]) => mockPrismaUserUpsert(...args),
    },
  },
}));

const { ensureUserRecord } = await import("./ensure-user-record");

function createSupabaseUser(
  user: Partial<SupabaseUser> & Pick<SupabaseUser, "id">
): SupabaseUser {
  return {
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-06-15T00:00:00.000Z",
    email: undefined,
    user_metadata: {},
    ...user,
  } as SupabaseUser;
}

describe("ensureUserRecord", () => {
  const now = new Date("2026-06-15T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    mockPrismaUserUpsert.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Supabase Auth ユーザーから m_user を upsert する", async () => {
    const user = createSupabaseUser({
      id: "user-123",
      email: "user@example.com",
      user_metadata: {
        full_name: "山田 太郎",
        avatar_url: "https://example.com/avatar.png",
      },
    });

    await ensureUserRecord(user);

    expect(mockPrismaUserUpsert).toHaveBeenCalledWith({
      where: { id: "user-123" },
      update: {
        email: "user@example.com",
        name: "山田 太郎",
        avatarUrl: "https://example.com/avatar.png",
        lastLoginAt: now,
      },
      create: {
        id: "user-123",
        email: "user@example.com",
        name: "山田 太郎",
        avatarUrl: "https://example.com/avatar.png",
        lastLoginAt: now,
      },
    });
  });

  it("metadata が不足している場合は既存の name / avatarUrl を null で上書きしない", async () => {
    const user = createSupabaseUser({
      id: "user-456",
      email: null,
      user_metadata: {},
    });

    await ensureUserRecord(user);

    expect(mockPrismaUserUpsert).toHaveBeenCalledWith({
      where: { id: "user-456" },
      update: {
        email: null,
        lastLoginAt: now,
      },
      create: {
        id: "user-456",
        email: null,
        name: null,
        avatarUrl: null,
        lastLoginAt: now,
      },
    });
  });

  it("role 指定時も updateRole が true でなければ既存ユーザーの role を変更しない", async () => {
    const user = createSupabaseUser({
      id: "user-789",
      email: "role@example.com",
      user_metadata: { display_name: "表示名", picture: "https://example.com/pic.png" },
    });

    await ensureUserRecord(user, { role: "organization" });

    expect(mockPrismaUserUpsert).toHaveBeenCalledWith({
      where: { id: "user-789" },
      update: {
        email: "role@example.com",
        name: "表示名",
        avatarUrl: "https://example.com/pic.png",
        lastLoginAt: now,
      },
      create: {
        id: "user-789",
        email: "role@example.com",
        name: "表示名",
        avatarUrl: "https://example.com/pic.png",
        lastLoginAt: now,
        role: "organization",
      },
    });
  });

  it("updateRole が true の場合は既存ユーザーの role も同期する", async () => {
    const user = createSupabaseUser({
      id: "user-admin",
      email: "admin@example.com",
      user_metadata: { name: "管理者" },
    });

    await ensureUserRecord(user, { role: "admin", updateRole: true });

    expect(mockPrismaUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ role: "admin" }),
        create: expect.objectContaining({ role: "admin" }),
      })
    );
  });
});

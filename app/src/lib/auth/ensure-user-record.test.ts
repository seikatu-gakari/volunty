import type { User as SupabaseUser } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrismaUserCreate = vi.fn();
const mockPrismaUserUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: (...args: unknown[]) => mockPrismaUserCreate(...args),
      update: (...args: unknown[]) => mockPrismaUserUpdate(...args),
    },
  },
}));

const { ensureUserRecord } = await import("./ensure-user-record");

type SupabaseUserFixture = Omit<Partial<SupabaseUser>, "email"> &
  Pick<SupabaseUser, "id"> & {
    email?: string | null;
  };

function createSupabaseUser(
  user: SupabaseUserFixture
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
    mockPrismaUserCreate.mockResolvedValue({
      role: "participant",
      participantProfile: null,
      organizationProfile: null,
    });
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

    expect(mockPrismaUserCreate).toHaveBeenCalledWith({
      data: {
        id: "user-123",
        email: "user@example.com",
        name: "山田 太郎",
        avatarUrl: "https://example.com/avatar.png",
        lastLoginAt: now,
      },
      select: {
        role: true,
        participantProfile: { select: { id: true } },
        organizationProfile: { select: { id: true } },
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

    expect(mockPrismaUserCreate).toHaveBeenCalledWith({
      data: {
        id: "user-456",
        email: null,
        lastLoginAt: now,
      },
      select: {
        role: true,
        participantProfile: { select: { id: true } },
        organizationProfile: { select: { id: true } },
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

    expect(mockPrismaUserCreate).toHaveBeenCalledWith({
      data: {
        id: "user-789",
        email: "role@example.com",
        name: "表示名",
        avatarUrl: "https://example.com/pic.png",
        lastLoginAt: now,
        role: "organization",
      },
      select: {
        role: true,
        participantProfile: { select: { id: true } },
        organizationProfile: { select: { id: true } },
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

    expect(mockPrismaUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "admin" }),
        select: {
          role: true,
          participantProfile: { select: { id: true } },
          organizationProfile: { select: { id: true } },
        },
      })
    );
  });

  it("upsert結果からDBロールと両プロフィールの有無を返す", async () => {
    mockPrismaUserCreate.mockResolvedValueOnce({
      role: "organization",
      participantProfile: { id: "participant-profile-1" },
      organizationProfile: null,
    });

    const result = await ensureUserRecord(
      createSupabaseUser({ id: "user-state" }),
    );

    expect(result).toEqual({
      role: "organization",
      hasParticipantProfile: true,
      hasOrganizationProfile: false,
      created: true,
    });
  });

  it("同時ログインで作成競合した場合は既存更新として扱う", async () => {
    mockPrismaUserCreate.mockRejectedValueOnce({ code: "P2002" });
    mockPrismaUserUpdate.mockResolvedValueOnce({
      role: "participant",
      participantProfile: null,
      organizationProfile: null,
    });

    const result = await ensureUserRecord(
      createSupabaseUser({ id: "user-existing" }),
    );

    expect(mockPrismaUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-existing" } }),
    );
    expect(result.created).toBe(false);
  });
});

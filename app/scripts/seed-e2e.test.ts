import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  upsert: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { upsert: mocks.upsert },
    $disconnect: mocks.disconnect,
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        listUsers: mocks.listUsers,
        createUser: mocks.createUser,
        updateUserById: mocks.updateUserById,
      },
    },
  }),
}));

vi.mock("@/lib/test-auth/personas", () => ({
  PERSONAS: {
    admin: {
      key: "admin",
      email: "e2e-admin@example.com",
      role: "admin",
      description: "管理者ロール",
    },
  },
}));

import { seedE2eUsers } from "./seed-e2e";

describe("seedE2eUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "test-password");
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("パスワード未設定の場合は処理を開始しない", async () => {
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "");

    await expect(seedE2eUsers()).rejects.toThrow(
      "E2E_TEST_USER_PASSWORD が未設定です"
    );
    expect(mocks.listUsers).not.toHaveBeenCalled();
  });

  it("既存の Auth ユーザーはパスワードを更新して m_user を upsert する", async () => {
    mocks.listUsers.mockResolvedValue({
      data: { users: [{ id: "existing-user", email: "e2e-admin@example.com" }] },
      error: null,
    });
    mocks.updateUserById.mockResolvedValue({ error: null });
    mocks.upsert.mockResolvedValue({});

    await seedE2eUsers();

    expect(mocks.updateUserById).toHaveBeenCalledWith("existing-user", {
      password: "test-password",
      user_metadata: {
        full_name: "E2E admin",
        onboarding_completed: true,
        role: "admin",
      },
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { id: "existing-user" },
      update: { role: "admin", email: "e2e-admin@example.com" },
      create: {
        id: "existing-user",
        email: "e2e-admin@example.com",
        name: "E2E admin",
        role: "admin",
      },
    });
  });

  it("Auth ユーザーが存在しない場合は作成して m_user を upsert する", async () => {
    mocks.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    mocks.createUser.mockResolvedValue({
      data: { user: { id: "new-user", email: "e2e-admin@example.com" } },
      error: null,
    });
    mocks.upsert.mockResolvedValue({});

    await seedE2eUsers();

    expect(mocks.createUser).toHaveBeenCalledWith({
      email: "e2e-admin@example.com",
      password: "test-password",
      email_confirm: true,
      user_metadata: {
        full_name: "E2E admin",
        onboarding_completed: true,
        role: "admin",
      },
    });
    expect(mocks.updateUserById).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "new-user" } })
    );
  });

  it("Auth ユーザー一覧の取得失敗を握りつぶさない", async () => {
    mocks.listUsers.mockResolvedValue({
      data: { users: [] },
      error: { message: "list failed" },
    });

    await expect(seedE2eUsers()).rejects.toThrow(
      "[seed] ユーザー一覧取得失敗: list failed"
    );
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
});

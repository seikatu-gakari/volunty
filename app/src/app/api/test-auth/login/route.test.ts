import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  ensureUserRecord: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
    },
  }),
}));

vi.mock("@/lib/auth/ensure-user-record", () => ({
  ensureUserRecord: mocks.ensureUserRecord,
}));

import { GET } from "./route";

const adminUser = {
  id: "user-admin",
  email: "e2e-admin@example.com",
  user_metadata: { full_name: "E2E admin" },
};

function createRequest(query = "") {
  return new Request(`http://localhost:3000/api/test-auth/login${query}`);
}

describe("GET /api/test-auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_AUTH_ENABLED", "true");
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "test-password");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: adminUser },
      error: null,
    });
    mocks.ensureUserRecord.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("NODE_ENV=production のとき 404 を返す", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET(createRequest("?persona=admin"));

    expect(response.status).toBe(404);
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("E2E_AUTH_ENABLED が true でないとき 404 を返す", async () => {
    vi.stubEnv("E2E_AUTH_ENABLED", "");

    const response = await GET(createRequest("?persona=admin"));

    expect(response.status).toBe(404);
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("persona 未指定のとき 400 を返す", async () => {
    const response = await GET(createRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "persona パラメータが必要です",
    });
  });

  it("不明な persona のとき 400 を返す", async () => {
    const response = await GET(createRequest("?persona=unknown"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "不明な persona: unknown",
    });
  });

  it("パスワード未設定のとき 500 を返す", async () => {
    vi.stubEnv("E2E_TEST_USER_PASSWORD", "");

    const response = await GET(createRequest("?persona=admin"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "サーバー設定エラー",
    });
  });

  it("Supabase 認証に失敗したとき 401 を返す", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const response = await GET(createRequest("?persona=admin"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "認証失敗",
      detail: "Invalid login credentials",
    });
    expect(mocks.ensureUserRecord).not.toHaveBeenCalled();
  });

  it("m_user 同期に失敗したとき 500 を返す", async () => {
    mocks.ensureUserRecord.mockRejectedValueOnce(new Error("DB error"));

    const response = await GET(createRequest("?persona=admin"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "ユーザーレコード同期失敗",
    });
  });

  it("認証成功時は persona の認証情報とロールを使って内部パスへリダイレクトする", async () => {
    const response = await GET(
      createRequest("?persona=admin&next=%2Fadmin%2Fusers%3Fstatus%3Dactive")
    );

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "e2e-admin@example.com",
      password: "test-password",
    });
    expect(mocks.ensureUserRecord).toHaveBeenCalledWith(adminUser, {
      role: "admin",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/users?status=active"
    );
  });

  it("Docker 内の 0.0.0.0 origin は localhost に補正する", async () => {
    const response = await GET(
      new Request(
        "http://0.0.0.0:3000/api/test-auth/login?persona=admin&next=%2Fadmin%2Fusers"
      )
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/admin/users"
    );
  });

  it("next が外部 URL のときトップへフォールバックする", async () => {
    const response = await GET(
      createRequest("?persona=admin&next=https%3A%2F%2Fevil.example%2F")
    );

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("next がプロトコル相対 URL のときトップへフォールバックする", async () => {
    const response = await GET(
      createRequest("?persona=admin&next=%2F%2Fevil.example%2F")
    );

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("next にバックスラッシュを含むときトップへフォールバックする", async () => {
    const response = await GET(
      createRequest("?persona=admin&next=%2F%5Cevil.example%2F")
    );

    expect(response.headers.get("location")).toBe("http://localhost:3000/");
  });
});

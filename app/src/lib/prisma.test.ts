import { afterEach, describe, expect, it } from "vitest";
import { resolvePrismaConnectionString } from "@/lib/prisma";

const originalSupabaseInternalUrl = process.env.SUPABASE_INTERNAL_URL;

afterEach(() => {
  process.env.SUPABASE_INTERNAL_URL = originalSupabaseInternalUrl;
});

describe("resolvePrismaConnectionString", () => {
  it("Docker 内部 URL がある場合は localhost の DB ホストを置き換える", () => {
    process.env.SUPABASE_INTERNAL_URL = "http://host.docker.internal:54321";

    const connectionString = resolvePrismaConnectionString(
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    );

    expect(connectionString).toBe(
      "postgresql://postgres:postgres@host.docker.internal:54322/postgres"
    );
  });

  it("ホスト実行時は localhost の DB ホストを維持する", () => {
    delete process.env.SUPABASE_INTERNAL_URL;

    const connectionString = resolvePrismaConnectionString(
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    );

    expect(connectionString).toBe(
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    );
  });

  it("pgbouncer パラメータを削除する", () => {
    const connectionString = resolvePrismaConnectionString(
      "postgresql://postgres:postgres@example.com:6543/postgres?pgbouncer=true&connection_limit=1"
    );

    expect(connectionString).toBe(
      "postgresql://postgres:postgres@example.com:6543/postgres?connection_limit=1"
    );
  });
});
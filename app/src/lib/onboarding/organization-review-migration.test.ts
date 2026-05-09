import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "..", "supabase/migrations");
const migrationFile = readdirSync(migrationsDir).find((file) =>
  file.endsWith("_add_organization_review_columns.sql")
);

if (!migrationFile) {
  throw new Error("団体審査カラム追加マイグレーションが見つかりません");
}

const migrationSql = readFileSync(
  resolve(migrationsDir, migrationFile),
  "utf8"
);

describe("団体審査カラム追加マイグレーション", () => {
  it("団体登録と審査に必要なカラムを追加する", () => {
    expect(migrationSql).toContain('"organization_review_status"');
    expect(migrationSql).toContain("'pending'");
    expect(migrationSql).toContain("'approved'");
    expect(migrationSql).toContain("'rejected'");
    expect(migrationSql).toContain('"review_status" "organization_review_status" NOT NULL DEFAULT');
    expect(migrationSql).toContain('"review_comment" TEXT');
    expect(migrationSql).toContain('"reviewed_at" TIMESTAMP(3)');
    expect(migrationSql).toContain('"reviewed_by" UUID');
    expect(migrationSql).toContain('"m_organization_profile_review_status_idx"');
  });
});

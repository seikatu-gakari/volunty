import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

function findMigrationsDir(startDir: string): string {
  let currentDir = resolve(startDir);

  while (currentDir !== dirname(currentDir)) {
    const migrationsDir = resolve(currentDir, "supabase/migrations");
    try {
      readdirSync(migrationsDir);
      return migrationsDir;
    } catch {
      currentDir = dirname(currentDir);
    }
  }

  throw new Error("supabase/migrations ディレクトリが見つかりません");
}

describe("団体審査カラム追加マイグレーション", () => {
  it("団体登録と審査に必要なカラムを追加する", () => {
    const migrationsDir = findMigrationsDir(process.cwd());
    const migrationFile = readdirSync(migrationsDir).find((file) =>
      file.endsWith("_add_organization_review_columns.sql")
    );

    if (!migrationFile) {
      expect(migrationFile).toBeDefined();
      return;
    }

    const migrationSql = readFileSync(
      resolve(migrationsDir, migrationFile),
      "utf8"
    );

    expect(migrationSql).toContain('"organization_review_status"');
    expect(migrationSql).toContain("'pending'");
    expect(migrationSql).toContain("'approved'");
    expect(migrationSql).toContain("'rejected'");
    expect(migrationSql).toContain('"review_status" "organization_review_status" DEFAULT');
    expect(migrationSql).toContain('ALTER COLUMN "review_status" SET NOT NULL');
    expect(migrationSql).toContain('"review_comment" TEXT');
    expect(migrationSql).toContain('"reviewed_at" TIMESTAMP(3)');
    expect(migrationSql).toContain('"reviewed_by" UUID');
    expect(migrationSql).toContain('"m_organization_profile_review_status_idx"');
  });
});

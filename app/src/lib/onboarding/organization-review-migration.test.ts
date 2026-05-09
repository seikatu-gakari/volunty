import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "../supabase/migrations/20260509000000_add_organization_review_columns.sql"),
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

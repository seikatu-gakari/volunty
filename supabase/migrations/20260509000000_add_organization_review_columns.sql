-- AlterTable: 団体審査ステータス管理に必要なカラムを追加
-- PostgreSQL では CREATE TYPE IF NOT EXISTS が使えないため、既存型のみ無視する
DO $$
BEGIN
  CREATE TYPE "organization_review_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "m_organization_profile"
ADD COLUMN "review_status" "organization_review_status" DEFAULT 'pending',
ADD COLUMN "review_comment" TEXT,
ADD COLUMN "reviewed_at" TIMESTAMP(3),
ADD COLUMN "reviewed_by" UUID;

UPDATE "m_organization_profile"
SET "review_status" = 'pending'
WHERE "review_status" IS NULL;

ALTER TABLE "m_organization_profile"
ALTER COLUMN "review_status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "m_organization_profile_review_status_idx"
ON "m_organization_profile"("review_status");

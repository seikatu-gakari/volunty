-- AlterTable: 団体審査ステータス管理に必要なカラムを追加
DO $$
BEGIN
  CREATE TYPE "organization_review_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "m_organization_profile"
ADD COLUMN "review_status" "organization_review_status" NOT NULL DEFAULT 'pending',
ADD COLUMN "review_comment" TEXT,
ADD COLUMN "reviewed_at" TIMESTAMP(3),
ADD COLUMN "reviewed_by" UUID;

CREATE INDEX IF NOT EXISTS "m_organization_profile_review_status_idx"
ON "m_organization_profile"("review_status");

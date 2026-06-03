-- AlterTable: 団体プロフィールに審査ステータスカラムを追加
CREATE TYPE "organization_review_status" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "m_organization_profile"
ADD COLUMN "review_status" "organization_review_status" NOT NULL DEFAULT 'pending',
ADD COLUMN "review_comment" TEXT,
ADD COLUMN "reviewed_at" TIMESTAMP(3),
ADD COLUMN "reviewed_by" UUID;

CREATE INDEX "m_organization_profile_review_status_idx"
ON "m_organization_profile"("review_status");

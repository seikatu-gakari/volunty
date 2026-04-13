-- AlterTable: 参加者プロフィールに不足カラムを追加 + 既存カラムの型制約を修正
ALTER TABLE "m_participant_profile" ADD COLUMN     "diagnosis_scores" JSONB,
ADD COLUMN     "diagnosis_type" VARCHAR(100),
ALTER COLUMN "birthday" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "gender" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "region" SET NOT NULL,
ALTER COLUMN "region" SET DATA TYPE VARCHAR(100);

-- AlterTable: 団体プロフィールに不足カラムを追加
ALTER TABLE "m_organization_profile" ADD COLUMN     "activity_categories" JSONB,
ADD COLUMN     "contact_email" VARCHAR(255),
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "profile_completeness" INTEGER NOT NULL DEFAULT 0;

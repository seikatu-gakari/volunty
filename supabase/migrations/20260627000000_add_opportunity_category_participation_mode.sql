-- PrismaスキーマとローカルSupabaseの募集案件カラムを同期する。
DO $$
BEGIN
  CREATE TYPE "participation_mode" AS ENUM ('online', 'offline', 'hybrid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "m_opportunity"
  ADD COLUMN IF NOT EXISTS "category" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "participation_mode" "participation_mode";

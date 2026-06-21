-- アカウント凍結の監査カラムを m_user に追加
ALTER TABLE "m_user" ADD COLUMN "suspended_at" TIMESTAMP(3);
ALTER TABLE "m_user" ADD COLUMN "suspend_reason" TEXT;
ALTER TABLE "m_user" ADD COLUMN "suspended_by" UUID;

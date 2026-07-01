-- Prisma migrationには存在するがSupabase migration経路に不足していた
-- アプローチ・参加証明書テーブルを冪等に補完する。

DO $$
BEGIN
  CREATE TYPE "approach_status" AS ENUM ('sent', 'accepted', 'declined');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "t_approach" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "participant_profile_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "message" TEXT NOT NULL,
  "match_score" DOUBLE PRECISION,
  "status" "approach_status" NOT NULL DEFAULT 'sent',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "responded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "t_approach_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "t_approach_organization_id_participant_profile_id_opportunity_id_key"
  ON "t_approach"("organization_id", "participant_profile_id", "opportunity_id");
CREATE INDEX IF NOT EXISTS "t_approach_organization_id_idx" ON "t_approach"("organization_id");
CREATE INDEX IF NOT EXISTS "t_approach_participant_profile_id_idx" ON "t_approach"("participant_profile_id");
CREATE INDEX IF NOT EXISTS "t_approach_opportunity_id_idx" ON "t_approach"("opportunity_id");
CREATE INDEX IF NOT EXISTS "t_approach_status_idx" ON "t_approach"("status");
CREATE INDEX IF NOT EXISTS "t_approach_expires_at_idx" ON "t_approach"("expires_at");
CREATE INDEX IF NOT EXISTS "t_approach_created_at_idx" ON "t_approach"("created_at" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 't_approach_organization_id_fkey') THEN
    ALTER TABLE "t_approach" ADD CONSTRAINT "t_approach_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "m_organization_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 't_approach_participant_profile_id_fkey') THEN
    ALTER TABLE "t_approach" ADD CONSTRAINT "t_approach_participant_profile_id_fkey"
      FOREIGN KEY ("participant_profile_id") REFERENCES "m_participant_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 't_approach_opportunity_id_fkey') THEN
    ALTER TABLE "t_approach" ADD CONSTRAINT "t_approach_opportunity_id_fkey"
      FOREIGN KEY ("opportunity_id") REFERENCES "m_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  CREATE TYPE "certificate_status" AS ENUM ('pending', 'issued', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "t_certificate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "application_id" UUID NOT NULL,
  "participant_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "status" "certificate_status" NOT NULL DEFAULT 'pending',
  "certificate_number" VARCHAR(40),
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at" TIMESTAMP(3),
  "issued_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "t_certificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "t_certificate_application_id_key" ON "t_certificate"("application_id");
CREATE UNIQUE INDEX IF NOT EXISTS "t_certificate_certificate_number_key" ON "t_certificate"("certificate_number");
CREATE INDEX IF NOT EXISTS "t_certificate_status_idx" ON "t_certificate"("status");
CREATE INDEX IF NOT EXISTS "t_certificate_participant_id_idx" ON "t_certificate"("participant_id");
CREATE INDEX IF NOT EXISTS "t_certificate_organization_id_idx" ON "t_certificate"("organization_id");
CREATE INDEX IF NOT EXISTS "t_certificate_opportunity_id_idx" ON "t_certificate"("opportunity_id");
CREATE INDEX IF NOT EXISTS "t_certificate_requested_at_idx" ON "t_certificate"("requested_at" DESC);
CREATE INDEX IF NOT EXISTS "t_certificate_issued_at_idx" ON "t_certificate"("issued_at" DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 't_certificate_application_id_fkey') THEN
    ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_application_id_fkey"
      FOREIGN KEY ("application_id") REFERENCES "t_matching_candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 't_certificate_participant_id_fkey') THEN
    ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_participant_id_fkey"
      FOREIGN KEY ("participant_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 't_certificate_organization_id_fkey') THEN
    ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "m_organization_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 't_certificate_opportunity_id_fkey') THEN
    ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_opportunity_id_fkey"
      FOREIGN KEY ("opportunity_id") REFERENCES "m_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('participant', 'organization', 'admin');

-- CreateEnum
CREATE TYPE "opportunity_status" AS ENUM ('draft', 'published', 'closed');

-- CreateEnum
CREATE TYPE "matching_status" AS ENUM ('queued', 'applied', 'accepted', 'declined', 'completed');

-- CreateEnum
CREATE TYPE "matching_method" AS ENUM ('rule-based', 'collaborative', 'ai-enhanced', 'hybrid');

-- CreateTable
CREATE TABLE "m_user" (
    "id" UUID NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'participant',
    "email" VARCHAR(255),
    "name" VARCHAR(100),
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "m_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "m_participant_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "bio" TEXT,
    "interests" JSONB,
    "availability" JSONB,
    "preferred_location" VARCHAR(100),
    "public_profile" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "m_participant_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "m_organization_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "contact_line_id" VARCHAR(100),
    "contact_line_url" TEXT,
    "website_url" TEXT,
    "representative_name" VARCHAR(100),
    "activity_areas" JSONB,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "m_organization_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "m_personality_type" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type_id" VARCHAR(50) NOT NULL,
    "name_ja" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "criteria" JSONB NOT NULL,
    "priority" INTEGER NOT NULL,
    "strengths" JSONB,
    "suitable_activities" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "m_personality_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "m_opportunity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "requirement_traits" JSONB,
    "location" VARCHAR(255),
    "start_date" DATE,
    "end_date" DATE,
    "capacity" INTEGER,
    "current_applicants" INTEGER NOT NULL DEFAULT 0,
    "status" "opportunity_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "m_opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_diagnosis_result" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "personality_type_id" UUID,
    "big5_scores" JSONB NOT NULL,
    "closest_type_distance" DOUBLE PRECISION,
    "concluded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_diagnosis_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_matching_candidate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "participant_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "diagnosis_result_id" UUID,
    "match_score" DOUBLE PRECISION NOT NULL,
    "score_breakdown" JSONB,
    "status" "matching_status" NOT NULL DEFAULT 'queued',
    "method" "matching_method" NOT NULL DEFAULT 'rule-based',
    "message" TEXT,
    "applied_at" TIMESTAMP(3),
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_matching_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "m_user_email_idx" ON "m_user"("email");

-- CreateIndex
CREATE INDEX "m_user_role_idx" ON "m_user"("role");

-- CreateIndex
CREATE UNIQUE INDEX "m_participant_profile_user_id_key" ON "m_participant_profile"("user_id");

-- CreateIndex
CREATE INDEX "m_participant_profile_preferred_location_idx" ON "m_participant_profile"("preferred_location");

-- CreateIndex
CREATE UNIQUE INDEX "m_organization_profile_user_id_key" ON "m_organization_profile"("user_id");

-- CreateIndex
CREATE INDEX "m_organization_profile_verified_idx" ON "m_organization_profile"("verified");

-- CreateIndex
CREATE INDEX "m_organization_profile_organization_name_idx" ON "m_organization_profile"("organization_name");

-- CreateIndex
CREATE UNIQUE INDEX "m_personality_type_type_id_key" ON "m_personality_type"("type_id");

-- CreateIndex
CREATE INDEX "m_personality_type_priority_idx" ON "m_personality_type"("priority");

-- CreateIndex
CREATE INDEX "m_opportunity_status_idx" ON "m_opportunity"("status");

-- CreateIndex
CREATE INDEX "m_opportunity_published_at_idx" ON "m_opportunity"("published_at");

-- CreateIndex
CREATE INDEX "m_opportunity_organization_id_idx" ON "m_opportunity"("organization_id");

-- CreateIndex
CREATE INDEX "t_diagnosis_result_user_id_idx" ON "t_diagnosis_result"("user_id");

-- CreateIndex
CREATE INDEX "t_diagnosis_result_personality_type_id_idx" ON "t_diagnosis_result"("personality_type_id");

-- CreateIndex
CREATE INDEX "t_diagnosis_result_concluded_at_idx" ON "t_diagnosis_result"("concluded_at");

-- CreateIndex
CREATE INDEX "t_matching_candidate_status_idx" ON "t_matching_candidate"("status");

-- CreateIndex
CREATE INDEX "t_matching_candidate_participant_id_idx" ON "t_matching_candidate"("participant_id");

-- CreateIndex
CREATE INDEX "t_matching_candidate_opportunity_id_idx" ON "t_matching_candidate"("opportunity_id");

-- CreateIndex
CREATE INDEX "t_matching_candidate_match_score_idx" ON "t_matching_candidate"("match_score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "t_matching_candidate_participant_id_opportunity_id_key" ON "t_matching_candidate"("participant_id", "opportunity_id");

-- AddForeignKey
ALTER TABLE "m_participant_profile" ADD CONSTRAINT "m_participant_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "m_organization_profile" ADD CONSTRAINT "m_organization_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "m_opportunity" ADD CONSTRAINT "m_opportunity_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "m_organization_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_diagnosis_result" ADD CONSTRAINT "t_diagnosis_result_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_diagnosis_result" ADD CONSTRAINT "t_diagnosis_result_personality_type_id_fkey" FOREIGN KEY ("personality_type_id") REFERENCES "m_personality_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_matching_candidate" ADD CONSTRAINT "t_matching_candidate_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_matching_candidate" ADD CONSTRAINT "t_matching_candidate_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "m_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_matching_candidate" ADD CONSTRAINT "t_matching_candidate_diagnosis_result_id_fkey" FOREIGN KEY ("diagnosis_result_id") REFERENCES "t_diagnosis_result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

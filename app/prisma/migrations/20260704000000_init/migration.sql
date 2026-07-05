-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('participant', 'organization', 'admin');

-- CreateEnum
CREATE TYPE "opportunity_status" AS ENUM ('draft', 'published', 'closed');

-- CreateEnum
CREATE TYPE "participation_mode" AS ENUM ('online', 'offline', 'hybrid');

-- CreateEnum
CREATE TYPE "matching_status" AS ENUM ('queued', 'applied', 'accepted', 'declined', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "organization_review_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "approach_status" AS ENUM ('sent', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "certificate_status" AS ENUM ('pending', 'issued', 'rejected');

-- CreateEnum
CREATE TYPE "engagement_event_type" AS ENUM ('view', 'favorite');

-- CreateEnum
CREATE TYPE "engagement_source" AS ENUM ('recommendation', 'search', 'direct');

-- CreateEnum
CREATE TYPE "feedback_rater_role" AS ENUM ('participant', 'organization');

-- CreateTable
CREATE TABLE "m_user" (
    "id" UUID NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'participant',
    "email" VARCHAR(255),
    "name" VARCHAR(100),
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "suspended_at" TIMESTAMP(3),
    "suspend_reason" TEXT,
    "suspended_by" UUID,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "m_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "m_participant_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "birthday" DATE NOT NULL,
    "gender" VARCHAR(20),
    "bio" TEXT,
    "region" VARCHAR(100) NOT NULL,
    "interests" JSONB,
    "latest_diagnosis_result_id" UUID,
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
    "representative_name" VARCHAR(100),
    "contact_email" VARCHAR(255),
    "activity_areas" JSONB,
    "description" TEXT,
    "activity_categories" JSONB,
    "website_url" TEXT,
    "logo_url" TEXT,
    "contact_line_id" VARCHAR(100),
    "contact_line_url" TEXT,
    "review_status" "organization_review_status" NOT NULL DEFAULT 'pending',
    "review_comment" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "profile_completeness" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "m_organization_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "m_opportunity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "activity_style_tags" JSONB,
    "required_qualifications" JSONB,
    "min_age" INTEGER,
    "max_age" INTEGER,
    "location" VARCHAR(255),
    "start_date" DATE,
    "end_date" DATE,
    "capacity" INTEGER,
    "category" VARCHAR(50),
    "participation_mode" "participation_mode",
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
    "scale_code" VARCHAR(50) NOT NULL,
    "scale_version" VARCHAR(20) NOT NULL,
    "scoring_algorithm_version" VARCHAR(20) NOT NULL,
    "norms_version" VARCHAR(20),
    "style_type_version" VARCHAR(20) NOT NULL,
    "quality_rule_version" VARCHAR(20) NOT NULL,
    "raw_scores" JSONB NOT NULL,
    "scaled_scores" JSONB NOT NULL,
    "style_type_id" VARCHAR(50),
    "quality_flags" JSONB NOT NULL,
    "total_duration_ms" INTEGER,
    "resumed_count" INTEGER NOT NULL DEFAULT 0,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_diagnosis_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_diagnosis_response" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "diagnosis_result_id" UUID NOT NULL,
    "item_code" VARCHAR(50) NOT NULL,
    "value" INTEGER NOT NULL,
    "elapsed_ms" INTEGER,
    "changed_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_diagnosis_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_recommendation_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "rule_contributions" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "matching_rule_version" VARCHAR(20) NOT NULL,
    "diagnosis_result_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_recommendation_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_engagement_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "event" "engagement_event_type" NOT NULL,
    "source" "engagement_source" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_engagement_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_matching_candidate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "participant_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "recommendation_log_id" UUID,
    "status" "matching_status" NOT NULL DEFAULT 'queued',
    "message" TEXT,
    "applied_at" TIMESTAMP(3),
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_matching_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_participation_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "rater_role" "feedback_rater_role" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_participation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_approach" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "participant_profile_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "approach_status" NOT NULL DEFAULT 'sent',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_approach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t_certificate" (
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

-- CreateIndex
CREATE INDEX "m_user_email_idx" ON "m_user"("email");

-- CreateIndex
CREATE INDEX "m_user_role_idx" ON "m_user"("role");

-- CreateIndex
CREATE UNIQUE INDEX "m_participant_profile_user_id_key" ON "m_participant_profile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "m_participant_profile_latest_diagnosis_result_id_key" ON "m_participant_profile"("latest_diagnosis_result_id");

-- CreateIndex
CREATE INDEX "m_participant_profile_preferred_location_idx" ON "m_participant_profile"("preferred_location");

-- CreateIndex
CREATE UNIQUE INDEX "m_organization_profile_user_id_key" ON "m_organization_profile"("user_id");

-- CreateIndex
CREATE INDEX "m_organization_profile_review_status_idx" ON "m_organization_profile"("review_status");

-- CreateIndex
CREATE INDEX "m_organization_profile_verified_idx" ON "m_organization_profile"("verified");

-- CreateIndex
CREATE INDEX "m_organization_profile_organization_name_idx" ON "m_organization_profile"("organization_name");

-- CreateIndex
CREATE INDEX "m_opportunity_status_idx" ON "m_opportunity"("status");

-- CreateIndex
CREATE INDEX "m_opportunity_published_at_idx" ON "m_opportunity"("published_at");

-- CreateIndex
CREATE INDEX "m_opportunity_organization_id_idx" ON "m_opportunity"("organization_id");

-- CreateIndex
CREATE INDEX "t_diagnosis_result_user_id_idx" ON "t_diagnosis_result"("user_id");

-- CreateIndex
CREATE INDEX "t_diagnosis_result_answered_at_idx" ON "t_diagnosis_result"("answered_at");

-- CreateIndex
CREATE INDEX "t_diagnosis_response_diagnosis_result_id_idx" ON "t_diagnosis_response"("diagnosis_result_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_diagnosis_response_diagnosis_result_id_item_code_key" ON "t_diagnosis_response"("diagnosis_result_id", "item_code");

-- CreateIndex
CREATE INDEX "t_recommendation_log_user_id_created_at_idx" ON "t_recommendation_log"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "t_recommendation_log_opportunity_id_idx" ON "t_recommendation_log"("opportunity_id");

-- CreateIndex
CREATE INDEX "t_engagement_event_user_id_created_at_idx" ON "t_engagement_event"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "t_engagement_event_opportunity_id_event_idx" ON "t_engagement_event"("opportunity_id", "event");

-- CreateIndex
CREATE INDEX "t_matching_candidate_status_idx" ON "t_matching_candidate"("status");

-- CreateIndex
CREATE INDEX "t_matching_candidate_participant_id_idx" ON "t_matching_candidate"("participant_id");

-- CreateIndex
CREATE INDEX "t_matching_candidate_opportunity_id_idx" ON "t_matching_candidate"("opportunity_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_matching_candidate_participant_id_opportunity_id_key" ON "t_matching_candidate"("participant_id", "opportunity_id");

-- CreateIndex
CREATE INDEX "t_participation_feedback_application_id_idx" ON "t_participation_feedback"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_participation_feedback_application_id_rater_role_key" ON "t_participation_feedback"("application_id", "rater_role");

-- CreateIndex
CREATE INDEX "t_approach_organization_id_idx" ON "t_approach"("organization_id");

-- CreateIndex
CREATE INDEX "t_approach_participant_profile_id_idx" ON "t_approach"("participant_profile_id");

-- CreateIndex
CREATE INDEX "t_approach_opportunity_id_idx" ON "t_approach"("opportunity_id");

-- CreateIndex
CREATE INDEX "t_approach_status_idx" ON "t_approach"("status");

-- CreateIndex
CREATE INDEX "t_approach_expires_at_idx" ON "t_approach"("expires_at");

-- CreateIndex
CREATE INDEX "t_approach_created_at_idx" ON "t_approach"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "t_approach_organization_id_participant_profile_id_opportuni_key" ON "t_approach"("organization_id", "participant_profile_id", "opportunity_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_certificate_application_id_key" ON "t_certificate"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "t_certificate_certificate_number_key" ON "t_certificate"("certificate_number");

-- CreateIndex
CREATE INDEX "t_certificate_status_idx" ON "t_certificate"("status");

-- CreateIndex
CREATE INDEX "t_certificate_participant_id_idx" ON "t_certificate"("participant_id");

-- CreateIndex
CREATE INDEX "t_certificate_organization_id_idx" ON "t_certificate"("organization_id");

-- CreateIndex
CREATE INDEX "t_certificate_opportunity_id_idx" ON "t_certificate"("opportunity_id");

-- CreateIndex
CREATE INDEX "t_certificate_requested_at_idx" ON "t_certificate"("requested_at" DESC);

-- CreateIndex
CREATE INDEX "t_certificate_issued_at_idx" ON "t_certificate"("issued_at" DESC);

-- AddForeignKey
ALTER TABLE "m_participant_profile" ADD CONSTRAINT "m_participant_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "m_participant_profile" ADD CONSTRAINT "m_participant_profile_latest_diagnosis_result_id_fkey" FOREIGN KEY ("latest_diagnosis_result_id") REFERENCES "t_diagnosis_result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "m_organization_profile" ADD CONSTRAINT "m_organization_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "m_opportunity" ADD CONSTRAINT "m_opportunity_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "m_organization_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_diagnosis_result" ADD CONSTRAINT "t_diagnosis_result_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_diagnosis_response" ADD CONSTRAINT "t_diagnosis_response_diagnosis_result_id_fkey" FOREIGN KEY ("diagnosis_result_id") REFERENCES "t_diagnosis_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_recommendation_log" ADD CONSTRAINT "t_recommendation_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_recommendation_log" ADD CONSTRAINT "t_recommendation_log_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "m_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_recommendation_log" ADD CONSTRAINT "t_recommendation_log_diagnosis_result_id_fkey" FOREIGN KEY ("diagnosis_result_id") REFERENCES "t_diagnosis_result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_engagement_event" ADD CONSTRAINT "t_engagement_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_engagement_event" ADD CONSTRAINT "t_engagement_event_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "m_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_matching_candidate" ADD CONSTRAINT "t_matching_candidate_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_matching_candidate" ADD CONSTRAINT "t_matching_candidate_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "m_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_matching_candidate" ADD CONSTRAINT "t_matching_candidate_recommendation_log_id_fkey" FOREIGN KEY ("recommendation_log_id") REFERENCES "t_recommendation_log"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_participation_feedback" ADD CONSTRAINT "t_participation_feedback_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "t_matching_candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_approach" ADD CONSTRAINT "t_approach_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "m_organization_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_approach" ADD CONSTRAINT "t_approach_participant_profile_id_fkey" FOREIGN KEY ("participant_profile_id") REFERENCES "m_participant_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_approach" ADD CONSTRAINT "t_approach_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "m_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "t_matching_candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "m_organization_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "m_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;


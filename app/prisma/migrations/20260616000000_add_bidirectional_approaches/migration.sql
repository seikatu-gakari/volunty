-- CreateEnum
CREATE TYPE "approach_status" AS ENUM ('sent', 'accepted', 'declined');

-- CreateTable
CREATE TABLE "t_approach" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "participant_profile_id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "match_score" DOUBLE PRECISION,
    "status" "approach_status" NOT NULL DEFAULT 'sent',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_approach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "t_approach_organization_id_participant_profile_id_opportunity_id_key" ON "t_approach"("organization_id", "participant_profile_id", "opportunity_id");

-- CreateIndex
CREATE INDEX "t_approach_organization_id_idx" ON "t_approach"("organization_id");

-- CreateIndex
CREATE INDEX "t_approach_participant_profile_id_idx" ON "t_approach"("participant_profile_id");

-- CreateIndex
CREATE INDEX "t_approach_opportunity_id_idx" ON "t_approach"("opportunity_id");

-- CreateIndex
CREATE INDEX "t_approach_status_idx" ON "t_approach"("status");

-- CreateIndex
CREATE INDEX "t_approach_created_at_idx" ON "t_approach"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "t_approach" ADD CONSTRAINT "t_approach_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "m_organization_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_approach" ADD CONSTRAINT "t_approach_participant_profile_id_fkey" FOREIGN KEY ("participant_profile_id") REFERENCES "m_participant_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_approach" ADD CONSTRAINT "t_approach_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "m_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

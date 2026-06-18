-- CreateEnum
CREATE TYPE "certificate_status" AS ENUM ('pending', 'issued', 'rejected');

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
ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "t_matching_candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "m_organization_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "t_certificate" ADD CONSTRAINT "t_certificate_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "m_opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

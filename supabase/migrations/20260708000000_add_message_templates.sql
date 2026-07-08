CREATE TABLE "m_message_template" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "m_message_template_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "m_message_template_organization_id_name_key" ON "m_message_template"("organization_id", "name");

CREATE INDEX "m_message_template_organization_id_idx" ON "m_message_template"("organization_id");

ALTER TABLE "m_message_template" ADD CONSTRAINT "m_message_template_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "m_organization_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

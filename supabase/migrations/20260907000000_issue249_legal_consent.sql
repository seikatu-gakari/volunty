CREATE TABLE "public"."t_legal_consent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "terms_version" VARCHAR(50) NOT NULL,
    "privacy_version" VARCHAR(50) NOT NULL,
    "agreed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t_legal_consent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "t_legal_consent_user_id_terms_version_privacy_version_key"
ON "public"."t_legal_consent"("user_id", "terms_version", "privacy_version");

CREATE INDEX "t_legal_consent_user_id_agreed_at_idx"
ON "public"."t_legal_consent"("user_id", "agreed_at");

ALTER TABLE "public"."t_legal_consent"
ADD CONSTRAINT "t_legal_consent_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "public"."m_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

REVOKE ALL ON TABLE "public"."t_legal_consent" FROM anon, authenticated;

CREATE TABLE "public"."t_account_deletion_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "auth_deleted_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t_account_deletion_request_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "t_account_deletion_request_user_id_key"
ON "public"."t_account_deletion_request"("user_id");

CREATE INDEX "t_account_deletion_request_created_at_idx"
ON "public"."t_account_deletion_request"("created_at");

REVOKE ALL ON TABLE "public"."t_account_deletion_request" FROM anon, authenticated;

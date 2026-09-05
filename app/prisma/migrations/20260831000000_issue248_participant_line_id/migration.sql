ALTER TABLE "m_participant_profile"
ADD COLUMN "line_id" VARCHAR(100);

COMMENT ON COLUMN "m_participant_profile"."line_id" IS
'応募が成立した自団体案件の団体にのみ共有する参加者LINE ID';

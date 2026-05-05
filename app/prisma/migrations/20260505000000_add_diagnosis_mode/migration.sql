-- 診断モード（簡易/詳細）を保存する
ALTER TABLE "m_participant_profile"
ADD COLUMN "diagnosis_mode" VARCHAR(20);

ALTER TABLE "t_diagnosis_result"
ADD COLUMN "diagnosis_mode" VARCHAR(20) NOT NULL DEFAULT 'brief';

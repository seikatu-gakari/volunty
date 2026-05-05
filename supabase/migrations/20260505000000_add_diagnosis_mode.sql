-- 診断モード（簡易/詳細）を保存する
ALTER TABLE public.m_participant_profile
ADD COLUMN IF NOT EXISTS diagnosis_mode VARCHAR(20);

ALTER TABLE public.t_diagnosis_result
ADD COLUMN IF NOT EXISTS diagnosis_mode VARCHAR(20) NOT NULL DEFAULT 'brief';

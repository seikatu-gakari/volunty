-- Issue #199: 旧migration履歴から欠落した最新診断結果の参照を復元する。
ALTER TABLE public.m_participant_profile
  ADD COLUMN IF NOT EXISTS latest_diagnosis_result_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS
  m_participant_profile_latest_diagnosis_result_id_key
  ON public.m_participant_profile(latest_diagnosis_result_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.m_participant_profile'::regclass
      AND conname = 'm_participant_profile_latest_diagnosis_result_id_fkey'
  ) THEN
    ALTER TABLE public.m_participant_profile
      ADD CONSTRAINT m_participant_profile_latest_diagnosis_result_id_fkey
      FOREIGN KEY (latest_diagnosis_result_id)
      REFERENCES public.t_diagnosis_result(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END;
$$;

-- 旧診断済みユーザーは最新の診断結果を引き継ぐ。
UPDATE public.m_participant_profile AS participant_profile
SET latest_diagnosis_result_id = (
  SELECT diagnosis_result.id
  FROM public.t_diagnosis_result AS diagnosis_result
  WHERE diagnosis_result.user_id = participant_profile.user_id
  ORDER BY diagnosis_result.created_at DESC, diagnosis_result.id DESC
  LIMIT 1
)
WHERE participant_profile.latest_diagnosis_result_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.t_diagnosis_result AS diagnosis_result
    WHERE diagnosis_result.user_id = participant_profile.user_id
  );

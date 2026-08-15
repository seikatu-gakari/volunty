-- Issue #199: マイページが参照する最新診断サマリ列を旧schemaへ追加する。
ALTER TABLE public.t_diagnosis_result
  ADD COLUMN IF NOT EXISTS style_type_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP(3);

-- 旧診断結果は作成日時を回答完了日時として引き継ぐ。
UPDATE public.t_diagnosis_result
SET answered_at = created_at
WHERE answered_at IS NULL;

ALTER TABLE public.t_diagnosis_result
  ALTER COLUMN answered_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN answered_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS t_diagnosis_result_answered_at_idx
  ON public.t_diagnosis_result(answered_at);

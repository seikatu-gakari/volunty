-- Issue #199: 未適用baseline以前の診断schemaを現行の保存契約へ前方修復する。
ALTER TABLE public.t_diagnosis_result
  ADD COLUMN IF NOT EXISTS scale_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS scale_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS scoring_algorithm_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS norms_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS style_type_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS quality_rule_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS raw_scores JSONB,
  ADD COLUMN IF NOT EXISTS scaled_scores JSONB,
  ADD COLUMN IF NOT EXISTS quality_flags JSONB,
  ADD COLUMN IF NOT EXISTS total_duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS resumed_count INTEGER;

-- 旧診断結果を消さず、現行schemaで読める値へ補完する。
UPDATE public.t_diagnosis_result
SET scale_code = COALESCE(scale_code, 'legacy-big5'),
    scale_version = COALESCE(scale_version, 'legacy'),
    scoring_algorithm_version = COALESCE(
      scoring_algorithm_version,
      'legacy'
    ),
    style_type_version = COALESCE(style_type_version, 'legacy'),
    quality_rule_version = COALESCE(quality_rule_version, 'legacy'),
    raw_scores = COALESCE(raw_scores, '{}'::jsonb),
    scaled_scores = COALESCE(scaled_scores, '{}'::jsonb),
    quality_flags = COALESCE(quality_flags, '[]'::jsonb),
    resumed_count = COALESCE(resumed_count, 0);

-- 旧big5_scoresを現行5ドメインへ変換する。
-- emotionalStabilityは旧neuroticismを反転し、intellectは旧opennessを引き継ぐ。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 't_diagnosis_result'
      AND column_name = 'big5_scores'
  ) THEN
    EXECUTE $sql$
      WITH legacy_scores AS (
        SELECT
          id,
          CASE
            WHEN jsonb_typeof(big5_scores -> 'extraversion') = 'number'
              THEN (big5_scores ->> 'extraversion')::numeric
            ELSE 50
          END AS extraversion,
          CASE
            WHEN jsonb_typeof(big5_scores -> 'agreeableness') = 'number'
              THEN (big5_scores ->> 'agreeableness')::numeric
            ELSE 50
          END AS agreeableness,
          CASE
            WHEN jsonb_typeof(big5_scores -> 'conscientiousness') = 'number'
              THEN (big5_scores ->> 'conscientiousness')::numeric
            ELSE 50
          END AS conscientiousness,
          CASE
            WHEN jsonb_typeof(big5_scores -> 'emotionalStability') = 'number'
              THEN (big5_scores ->> 'emotionalStability')::numeric
            WHEN jsonb_typeof(big5_scores -> 'neuroticism') = 'number'
              THEN 100 - (big5_scores ->> 'neuroticism')::numeric
            ELSE 50
          END AS emotional_stability,
          CASE
            WHEN jsonb_typeof(big5_scores -> 'intellect') = 'number'
              THEN (big5_scores ->> 'intellect')::numeric
            WHEN jsonb_typeof(big5_scores -> 'openness') = 'number'
              THEN (big5_scores ->> 'openness')::numeric
            ELSE 50
          END AS intellect
        FROM public.t_diagnosis_result
        WHERE big5_scores IS NOT NULL
      ), normalized_scores AS (
        SELECT
          id,
          GREATEST(0, LEAST(100, extraversion)) AS extraversion,
          GREATEST(0, LEAST(100, agreeableness)) AS agreeableness,
          GREATEST(0, LEAST(100, conscientiousness)) AS conscientiousness,
          GREATEST(0, LEAST(100, emotional_stability))
            AS emotional_stability,
          GREATEST(0, LEAST(100, intellect)) AS intellect
        FROM legacy_scores
      )
      UPDATE public.t_diagnosis_result AS diagnosis_result
      SET scaled_scores = jsonb_build_object(
            'extraversion', scores.extraversion,
            'agreeableness', scores.agreeableness,
            'conscientiousness', scores.conscientiousness,
            'emotionalStability', scores.emotional_stability,
            'intellect', scores.intellect
          ),
          raw_scores = jsonb_build_object(
            'extraversion', ROUND(10 + scores.extraversion * 0.4),
            'agreeableness', ROUND(10 + scores.agreeableness * 0.4),
            'conscientiousness', ROUND(10 + scores.conscientiousness * 0.4),
            'emotionalStability',
              ROUND(10 + scores.emotional_stability * 0.4),
            'intellect', ROUND(10 + scores.intellect * 0.4)
          )
      FROM normalized_scores AS scores
      WHERE diagnosis_result.id = scores.id
    $sql$;

    ALTER TABLE public.t_diagnosis_result
      ALTER COLUMN big5_scores DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 't_diagnosis_result'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.t_diagnosis_result
      ALTER COLUMN updated_at DROP NOT NULL;
  END IF;
END;
$$;

ALTER TABLE public.t_diagnosis_result
  ALTER COLUMN scale_code SET NOT NULL,
  ALTER COLUMN scale_version SET NOT NULL,
  ALTER COLUMN scoring_algorithm_version SET NOT NULL,
  ALTER COLUMN style_type_version SET NOT NULL,
  ALTER COLUMN quality_rule_version SET NOT NULL,
  ALTER COLUMN raw_scores SET NOT NULL,
  ALTER COLUMN scaled_scores SET NOT NULL,
  ALTER COLUMN quality_flags SET NOT NULL,
  ALTER COLUMN resumed_count SET DEFAULT 0,
  ALTER COLUMN resumed_count SET NOT NULL;

CREATE INDEX IF NOT EXISTS t_diagnosis_result_user_id_idx
  ON public.t_diagnosis_result(user_id);

CREATE TABLE IF NOT EXISTS public.t_diagnosis_response (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  diagnosis_result_id UUID NOT NULL,
  item_code VARCHAR(50) NOT NULL,
  value INTEGER NOT NULL,
  elapsed_ms INTEGER,
  changed_count INTEGER,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT t_diagnosis_response_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS t_diagnosis_response_diagnosis_result_id_idx
  ON public.t_diagnosis_response(diagnosis_result_id);

CREATE UNIQUE INDEX IF NOT EXISTS
  t_diagnosis_response_diagnosis_result_id_item_code_key
  ON public.t_diagnosis_response(diagnosis_result_id, item_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.t_diagnosis_response'::regclass
      AND conname = 't_diagnosis_response_diagnosis_result_id_fkey'
  ) THEN
    ALTER TABLE public.t_diagnosis_response
      ADD CONSTRAINT t_diagnosis_response_diagnosis_result_id_fkey
      FOREIGN KEY (diagnosis_result_id)
      REFERENCES public.t_diagnosis_result(id)
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END;
$$;

-- Supabase Data APIからは本人の診断サマリだけを参照可能にする。
-- 生回答はserver-side Prisma経由のみ利用し、Data API権限を付与しない。
ALTER TABLE public.t_diagnosis_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_diagnosis_response ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "参加者は自分の診断結果を閲覧可能"
  ON public.t_diagnosis_result;
CREATE POLICY "参加者は自分の診断結果を閲覧可能"
  ON public.t_diagnosis_result FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "参加者は自分の診断結果を作成可能"
  ON public.t_diagnosis_result;
CREATE POLICY "参加者は自分の診断結果を作成可能"
  ON public.t_diagnosis_result FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "参加者は自分の生回答を閲覧可能"
  ON public.t_diagnosis_response;
CREATE POLICY "参加者は自分の生回答を閲覧可能"
  ON public.t_diagnosis_response FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.t_diagnosis_result AS diagnosis_result
      WHERE diagnosis_result.id = diagnosis_result_id
        AND diagnosis_result.user_id = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.t_diagnosis_result
  FROM anon, authenticated;
REVOKE ALL ON TABLE public.t_diagnosis_response
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.t_diagnosis_result TO authenticated;

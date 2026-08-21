#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd "$script_dir/.." && pwd -P)"

for command_name in initdb pg_ctl psql; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'skip: %s is required for the local RLS test\n' "$command_name"
    exit 0
  fi
done

test_tmp="$(mktemp -d)"
data_dir="$test_tmp/data"
database_name="volunty_rls_test"
port=$((55432 + RANDOM % 1000))
database_url="postgresql://$(id -un)@127.0.0.1:$port/$database_name"
race_a_pid=""
race_b_pid=""
race_a_fd=""

cleanup() {
  if [ -n "$race_a_fd" ]; then
    eval "exec ${race_a_fd}>&-" || true
  fi
  if [ -n "$race_a_pid" ]; then
    kill "$race_a_pid" >/dev/null 2>&1 || true
  fi
  if [ -n "$race_b_pid" ]; then
    kill "$race_b_pid" >/dev/null 2>&1 || true
  fi
  pg_ctl -D "$data_dir" -m fast stop >/dev/null 2>&1 || true
  rm -rf "$test_tmp"
}
trap cleanup EXIT

initdb -D "$data_dir" --no-locale --encoding=UTF8 --auth=trust >/dev/null
pg_ctl -D "$data_dir" -o "-p $port -k $test_tmp" -l "$test_tmp/postgres.log" -w start >/dev/null

createdb_command="$(command -v createdb || true)"
if [ -z "$createdb_command" ]; then
  psql "$database_url" -v ON_ERROR_STOP=1 -X -c "CREATE DATABASE $database_name" >/dev/null
else
  "$createdb_command" -h 127.0.0.1 -p "$port" "$database_name" >/dev/null
fi

psql "$database_url" -v ON_ERROR_STOP=1 -X <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  instance_id uuid,
  id uuid PRIMARY KEY,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  confirmation_token text,
  recovery_token text,
  email_change_token_new text,
  email_change text
);
CREATE TABLE auth.identities (
  id uuid,
  user_id uuid,
  provider_id text,
  identity_data jsonb,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
SQL

psql "$database_url" -v ON_ERROR_STOP=1 -X -f "$repo_root/supabase/migrations/20260704000000_init.sql" >/dev/null
psql "$database_url" -v ON_ERROR_STOP=1 -X -f "$repo_root/supabase/migrations/20260708000000_add_message_templates.sql" >/dev/null

# 本番相当の public schema 権限・参加者プロフィール列なし状態から、
# 追跡 migration だけでアプリの前提schemaを復元できることを検証する。
psql "$database_url" -v ON_ERROR_STOP=1 -X <<'SQL' >/dev/null
INSERT INTO public.m_user (id, role, created_at, updated_at)
VALUES (
  '88888888-1111-1111-1111-111111111111',
  'participant', NOW(), NOW()
);
INSERT INTO public.t_diagnosis_result (
  id, user_id, scale_code, scale_version, scoring_algorithm_version,
  style_type_version, quality_rule_version, raw_scores, scaled_scores,
  style_type_id, quality_flags, answered_at, created_at
) VALUES (
  '88888888-2222-2222-2222-222222222222',
  '88888888-1111-1111-1111-111111111111',
  'legacy', '1', '1', '1', '1', '{}'::jsonb, '{}'::jsonb,
  'supporter-care', '[]'::jsonb,
  TIMESTAMP '2026-01-02 00:00:00', TIMESTAMP '2026-01-02 00:00:00'
);
INSERT INTO public.m_participant_profile (
  id, user_id, name, birthday, region, latest_diagnosis_result_id,
  created_at, updated_at
) VALUES (
  '88888888-3333-3333-3333-333333333333',
  '88888888-1111-1111-1111-111111111111',
  '旧診断済み参加者', DATE '2000-01-01', '東京都',
  '88888888-2222-2222-2222-222222222222', NOW(), NOW()
);
INSERT INTO public.m_user (id, role, created_at, updated_at)
VALUES
  (
    '99999999-1111-1111-1111-111111111111',
    'organization', NOW(), NOW()
  ),
  (
    '99999999-2222-2222-2222-222222222222',
    'organization', NOW(), NOW()
  );
INSERT INTO public.m_organization_profile (
  id, user_id, organization_name, review_status, verified, created_at, updated_at
) VALUES
  (
    '99999999-3333-3333-3333-333333333333',
    '99999999-1111-1111-1111-111111111111',
    '未承認のRLS団体', 'pending', false, NOW(), NOW()
  ),
  (
    '99999999-4444-4444-4444-444444444444',
    '99999999-2222-2222-2222-222222222222',
    '承認済みのRLS団体', 'approved', true, NOW(), NOW()
  );
INSERT INTO public.m_user (id, role, created_at, updated_at)
VALUES (
  '88888888-5555-5555-5555-555555555555',
  'participant', NOW(), NOW()
);
INSERT INTO public.m_participant_profile (
  id, user_id, name, birthday, region, created_at, updated_at
) VALUES (
  '88888888-6666-6666-6666-666666666666',
  '88888888-5555-5555-5555-555555555555',
  '別ユーザーのRLS参加者', DATE '2000-01-01', '東京都', NOW(), NOW()
);

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

-- 未適用baseline以前の本番診断schemaを再現する。
ALTER TABLE public.t_diagnosis_result
  ADD COLUMN personality_type_id UUID,
  ADD COLUMN big5_scores JSONB,
  ADD COLUMN closest_type_distance DOUBLE PRECISION,
  ADD COLUMN concluded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at TIMESTAMP(3),
  ADD COLUMN diagnosis_mode VARCHAR(50) NOT NULL DEFAULT 'brief';
UPDATE public.t_diagnosis_result
SET big5_scores = '{
      "extraversion": 65,
      "agreeableness": 70,
      "conscientiousness": 75,
      "neuroticism": 35,
      "openness": 80
    }'::jsonb,
    updated_at = created_at;
ALTER TABLE public.t_diagnosis_result
  ALTER COLUMN big5_scores SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DROP TABLE public.t_diagnosis_response;

-- Supabase本番の既定権限を再現し、migrationの明示REVOKEを検証する。
GRANT ALL PRIVILEGES ON TABLE public.t_diagnosis_result
  TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE
  public.m_message_template,
  public.t_recommendation_log,
  public.t_engagement_event,
  public.t_participation_feedback,
  public.t_approach,
  public.t_certificate
  TO anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE
  public.m_participant_profile,
  public.m_organization_profile
  TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated;

ALTER TABLE public.m_participant_profile
  DROP COLUMN latest_diagnosis_result_id;
ALTER TABLE public.t_diagnosis_result
  DROP COLUMN scale_code,
  DROP COLUMN scale_version,
  DROP COLUMN scoring_algorithm_version,
  DROP COLUMN norms_version,
  DROP COLUMN style_type_version,
  DROP COLUMN quality_rule_version,
  DROP COLUMN raw_scores,
  DROP COLUMN scaled_scores,
  DROP COLUMN style_type_id,
  DROP COLUMN quality_flags,
  DROP COLUMN total_duration_ms,
  DROP COLUMN resumed_count,
  DROP COLUMN answered_at;
SQL

psql "$database_url" -v ON_ERROR_STOP=1 -X -f "$repo_root/supabase/migrations/20260813004154_issue199_m_user_data_api_authz.sql" >/dev/null
psql "$database_url" -v ON_ERROR_STOP=1 -X -f "$repo_root/supabase/migrations/20260815025554_issue199_public_schema_usage.sql" >/dev/null
psql "$database_url" -v ON_ERROR_STOP=1 -X -f "$repo_root/supabase/migrations/20260815025856_issue199_participant_profile_schema_repair.sql" >/dev/null
psql "$database_url" -v ON_ERROR_STOP=1 -X -f "$repo_root/supabase/migrations/20260815030247_issue199_mypage_diagnosis_summary_schema_repair.sql" >/dev/null
psql "$database_url" -v ON_ERROR_STOP=1 -X -f "$repo_root/supabase/migrations/20260815075346_issue199_diagnosis_write_schema_repair.sql" >/dev/null
psql "$database_url" -v ON_ERROR_STOP=1 -X -f "$repo_root/supabase/migrations/20260822000000_issue215_profile_data_api_authz.sql" >/dev/null

psql "$database_url" -v ON_ERROR_STOP=1 -X <<'SQL' >/dev/null
DO $$
DECLARE
  profile_column_name text;
BEGIN
  IF NOT has_schema_privilege('authenticated', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'authenticated lacks USAGE on public schema';
  END IF;
  IF NOT has_schema_privilege('anon', 'public', 'USAGE') THEN
    RAISE EXCEPTION 'anon lacks USAGE on public schema';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = 'public.m_participant_profile'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'm_participant_profile RLS is disabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = 'public.m_organization_profile'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'm_organization_profile RLS is disabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'm_participant_profile'
      AND policyname = '参加者は自分のプロフィールを閲覧可能'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'm_organization_profile'
      AND policyname = '認証済み団体は全員閲覧可能'
  ) THEN
    RAISE EXCEPTION 'profile RLS policies are missing';
  END IF;
  IF has_table_privilege('anon', 'public.m_participant_profile', 'SELECT')
    OR has_table_privilege(
      'authenticated', 'public.m_participant_profile', 'INSERT'
    )
    OR has_table_privilege(
      'authenticated', 'public.m_participant_profile', 'UPDATE'
    )
    OR has_table_privilege(
      'authenticated', 'public.m_participant_profile', 'DELETE'
    )
    OR NOT has_table_privilege(
      'authenticated', 'public.m_participant_profile', 'SELECT'
    )
  THEN
    RAISE EXCEPTION 'participant profile Data API privileges are not minimal';
  END IF;
  IF has_table_privilege(
      'anon', 'public.m_organization_profile', 'INSERT'
    )
    OR has_table_privilege(
      'anon', 'public.m_organization_profile', 'UPDATE'
    )
    OR has_table_privilege(
      'anon', 'public.m_organization_profile', 'DELETE'
    )
    OR has_table_privilege(
      'authenticated', 'public.m_organization_profile', 'INSERT'
    )
    OR has_table_privilege(
      'authenticated', 'public.m_organization_profile', 'UPDATE'
    )
    OR has_table_privilege(
      'authenticated', 'public.m_organization_profile', 'DELETE'
    )
  THEN
    RAISE EXCEPTION 'organization profile Data API privileges are not minimal';
  END IF;
  FOREACH profile_column_name IN ARRAY ARRAY[
    'id', 'organization_name', 'description', 'verified', 'review_status'
  ] LOOP
    IF NOT has_column_privilege(
      'anon', 'public.m_organization_profile', profile_column_name, 'SELECT'
    ) THEN
      RAISE EXCEPTION 'anon cannot select public organization column: %', profile_column_name;
    END IF;
  END LOOP;
  FOREACH profile_column_name IN ARRAY ARRAY[
    'id', 'user_id', 'organization_name', 'description', 'verified',
    'review_status', 'contact_line_id', 'reviewed_at', 'profile_completeness'
  ] LOOP
    IF NOT has_column_privilege(
      'authenticated', 'public.m_organization_profile', profile_column_name, 'SELECT'
    ) THEN
      RAISE EXCEPTION 'authenticated cannot select organization column: %', profile_column_name;
    END IF;
  END LOOP;
  FOREACH profile_column_name IN ARRAY ARRAY[
    'representative_name', 'contact_email', 'activity_areas',
    'activity_categories', 'website_url', 'logo_url', 'contact_line_url',
    'review_comment', 'reviewed_by', 'created_at', 'updated_at'
  ] LOOP
    IF has_column_privilege(
      'anon', 'public.m_organization_profile', profile_column_name, 'SELECT'
    ) OR has_column_privilege(
      'authenticated', 'public.m_organization_profile', profile_column_name, 'SELECT'
    ) THEN
      RAISE EXCEPTION 'private organization column is exposed through Data API: %', profile_column_name;
    END IF;
  END LOOP;
  FOREACH profile_column_name IN ARRAY ARRAY['user_id', 'contact_line_id'] LOOP
    IF has_column_privilege(
      'anon', 'public.m_organization_profile', profile_column_name, 'SELECT'
    ) THEN
      RAISE EXCEPTION 'anon can select authenticated-only organization column: %', profile_column_name;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'm_message_template',
      't_diagnosis_response',
      't_recommendation_log',
      't_engagement_event',
      't_participation_feedback',
      't_approach',
      't_certificate'
    ]) AS protected_table(table_name)
    WHERE has_table_privilege(
      'anon',
      format('public.%I', protected_table.table_name),
      'SELECT'
    )
      OR has_table_privilege(
        'authenticated',
        format('public.%I', protected_table.table_name),
        'SELECT'
      )
      OR has_table_privilege(
        'authenticated',
        format('public.%I', protected_table.table_name),
        'INSERT'
      )
      OR has_table_privilege(
        'authenticated',
        format('public.%I', protected_table.table_name),
        'UPDATE'
      )
      OR has_table_privilege(
        'authenticated',
        format('public.%I', protected_table.table_name),
        'DELETE'
      )
  ) THEN
    RAISE EXCEPTION 'server-only table remains exposed through Data API';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'm_participant_profile'
      AND column_name = 'latest_diagnosis_result_id'
  ) THEN
    RAISE EXCEPTION 'm_participant_profile.latest_diagnosis_result_id is missing';
  END IF;
  IF to_regclass(
    'public.m_participant_profile_latest_diagnosis_result_id_key'
  ) IS NULL THEN
    RAISE EXCEPTION 'latest diagnosis result unique index is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.m_participant_profile'::regclass
      AND conname = 'm_participant_profile_latest_diagnosis_result_id_fkey'
  ) THEN
    RAISE EXCEPTION 'latest diagnosis result foreign key is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 't_diagnosis_result'
      AND column_name = 'style_type_id'
  ) THEN
    RAISE EXCEPTION 't_diagnosis_result.style_type_id is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 't_diagnosis_result'
      AND column_name = 'answered_at'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 't_diagnosis_result.answered_at is missing or nullable';
  END IF;
  IF to_regclass('public.t_diagnosis_result_answered_at_idx') IS NULL THEN
    RAISE EXCEPTION 'diagnosis answered_at index is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.m_participant_profile
    WHERE user_id = '88888888-1111-1111-1111-111111111111'
      AND latest_diagnosis_result_id =
        '88888888-2222-2222-2222-222222222222'
  ) THEN
    RAISE EXCEPTION 'latest diagnosis result was not backfilled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 't_diagnosis_result'
      AND column_name IN (
        'scale_code', 'scale_version', 'scoring_algorithm_version',
        'style_type_version', 'quality_rule_version', 'raw_scores',
        'scaled_scores', 'quality_flags', 'resumed_count'
      )
      AND is_nullable = 'NO'
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 9
  ) THEN
    RAISE EXCEPTION 'current diagnosis write columns are missing or nullable';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 't_diagnosis_result'
      AND column_name IN ('big5_scores', 'updated_at')
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'legacy-only diagnosis columns still block current writes';
  END IF;
  IF to_regclass('public.t_diagnosis_response') IS NULL THEN
    RAISE EXCEPTION 't_diagnosis_response is missing';
  END IF;
  IF to_regclass('public.t_diagnosis_response_diagnosis_result_id_idx') IS NULL THEN
    RAISE EXCEPTION 'diagnosis response lookup index is missing';
  END IF;
  IF to_regclass(
    'public.t_diagnosis_response_diagnosis_result_id_item_code_key'
  ) IS NULL THEN
    RAISE EXCEPTION 'diagnosis response unique index is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.t_diagnosis_response'::regclass
      AND conname = 't_diagnosis_response_diagnosis_result_id_fkey'
  ) THEN
    RAISE EXCEPTION 'diagnosis response foreign key is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = 'public.t_diagnosis_result'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'diagnosis result RLS is disabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = 'public.t_diagnosis_response'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'diagnosis response RLS is disabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 't_diagnosis_result'
      AND policyname = '参加者は自分の診断結果を閲覧可能'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 't_diagnosis_response'
      AND policyname = '参加者は自分の生回答を閲覧可能'
  ) THEN
    RAISE EXCEPTION 'diagnosis RLS policies are missing';
  END IF;
  IF has_table_privilege('anon', 'public.t_diagnosis_result', 'SELECT')
    OR has_table_privilege('anon', 'public.t_diagnosis_result', 'INSERT')
    OR has_table_privilege('authenticated', 'public.t_diagnosis_result', 'INSERT')
    OR has_table_privilege('authenticated', 'public.t_diagnosis_result', 'UPDATE')
    OR has_table_privilege('authenticated', 'public.t_diagnosis_result', 'DELETE')
    OR NOT has_table_privilege(
      'authenticated',
      'public.t_diagnosis_result',
      'SELECT'
    )
  THEN
    RAISE EXCEPTION 'diagnosis result Data API privileges are not minimal';
  END IF;
  IF has_table_privilege('anon', 'public.t_diagnosis_response', 'SELECT')
    OR has_table_privilege('anon', 'public.t_diagnosis_response', 'INSERT')
    OR has_table_privilege(
      'authenticated',
      'public.t_diagnosis_response',
      'SELECT'
    )
    OR has_table_privilege(
      'authenticated',
      'public.t_diagnosis_response',
      'INSERT'
    )
  THEN
    RAISE EXCEPTION 'diagnosis response Data API privileges are not revoked';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.t_diagnosis_result
    WHERE id = '88888888-2222-2222-2222-222222222222'
      AND raw_scores = '{
        "extraversion": 36,
        "agreeableness": 38,
        "conscientiousness": 40,
        "emotionalStability": 36,
        "intellect": 42
      }'::jsonb
      AND scaled_scores = '{
        "extraversion": 65,
        "agreeableness": 70,
        "conscientiousness": 75,
        "emotionalStability": 65,
        "intellect": 80
      }'::jsonb
      AND scale_code = 'legacy-big5'
      AND answered_at = TIMESTAMP '2026-01-02 00:00:00'
  ) THEN
    RAISE EXCEPTION 'legacy diagnosis data was not preserved and backfilled';
  END IF;
END;
$$;

SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '88888888-1111-1111-1111-111111111111',
  false
);
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.t_diagnosis_result) <> 1 THEN
    RAISE EXCEPTION 'diagnosis result RLS leaked another user row';
  END IF;
END;
$$;
RESET ROLE;

WITH inserted_result AS (
  INSERT INTO public.t_diagnosis_result (
    user_id, scale_code, scale_version, scoring_algorithm_version,
    style_type_version, quality_rule_version, raw_scores, scaled_scores,
    style_type_id, quality_flags, total_duration_ms, resumed_count
  ) VALUES (
    '88888888-1111-1111-1111-111111111111',
    'ipip-bfm-50-ja', '1', '1', '1', '1',
    '{"extraversion": 34}'::jsonb,
    '{"extraversion": 60}'::jsonb,
    'supporter-care', '[]'::jsonb, 120000, 0
  )
  RETURNING id
)
INSERT INTO public.t_diagnosis_response (
  diagnosis_result_id, item_code, value, elapsed_ms, changed_count
)
SELECT id, 'IPIP-BFM-01', 4, 1200, 0
FROM inserted_result;
SQL

psql "$database_url" -v ON_ERROR_STOP=1 -X <<'SQL' >/dev/null
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '88888888-1111-1111-1111-111111111111',
  false
);
DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.m_participant_profile
  ) <> 1 THEN
    RAISE EXCEPTION 'participant owner cannot read own profile or RLS leaked a row';
  END IF;
  IF (
    SELECT COUNT(*)
    FROM public.m_participant_profile
    WHERE user_id = '88888888-5555-5555-5555-555555555555'
  ) <> 0 THEN
    RAISE EXCEPTION 'participant can read another user profile';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claim.sub',
  '99999999-1111-1111-1111-111111111111',
  false
);
DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.m_participant_profile
  ) <> 0 THEN
    RAISE EXCEPTION 'participant profile RLS leaked another user row';
  END IF;
  IF (
    SELECT COUNT(*)
    FROM public.m_organization_profile
    WHERE user_id = auth.uid()
      AND review_status = 'pending'
  ) <> 1 THEN
    RAISE EXCEPTION 'organization owner cannot read own pending profile';
  END IF;
  IF (
    SELECT COUNT(*)
    FROM public.m_organization_profile
    WHERE review_status = 'approved'
  ) <> 1 THEN
    RAISE EXCEPTION 'authenticated user cannot read approved organization profile';
  END IF;
  IF (
    SELECT COUNT(*)
    FROM public.m_organization_profile
    WHERE user_id = '99999999-2222-2222-2222-222222222222'
      AND review_status = 'pending'
  ) <> 0 THEN
    RAISE EXCEPTION 'authenticated user can read another pending organization profile';
  END IF;
END;
$$;
RESET ROLE;

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public.m_organization_profile
    WHERE review_status = 'approved'
  ) <> 1 THEN
    RAISE EXCEPTION 'anon cannot read approved organization profile';
  END IF;
  IF (
    SELECT COUNT(*)
    FROM public.m_organization_profile
    WHERE review_status = 'pending'
  ) <> 0 THEN
    RAISE EXCEPTION 'anon can read pending organization profile';
  END IF;
END;
$$;
RESET ROLE;
SQL

psql "$database_url" -v ON_ERROR_STOP=1 -X -f "$repo_root/supabase/seed.sql" >/dev/null

# 応募 RLS の公開条件・推薦ログ所有条件を検証するための一時案件・ログ。
psql "$database_url" -v ON_ERROR_STOP=1 -X <<'SQL' >/dev/null
INSERT INTO public.m_opportunity (
  id, organization_id, title, status, published_at, end_date, created_at, updated_at
) VALUES
  (
    'f8888888-8888-8888-8888-888888888888',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'RLS テスト公開案件',
    'published', NOW() - INTERVAL '1 minute', CURRENT_DATE + 7, NOW(), NOW()
  ),
  (
    'f9999999-9999-9999-9999-999999999999',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'RLS テスト下書き案件',
    'draft', NULL, CURRENT_DATE + 7, NOW(), NOW()
  ),
  (
    'fa000000-0000-0000-0000-000000000000',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'RLS テスト公開予約案件',
    'published', NOW() + INTERVAL '1 day', CURRENT_DATE + 7, NOW(), NOW()
  ),
  (
    'fb000000-0000-0000-0000-000000000000',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'RLS テスト締切済み案件',
    'published', NOW() - INTERVAL '2 days', CURRENT_DATE - 1, NOW(), NOW()
  ),
  (
    'fc000000-0000-0000-0000-000000000000',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'RLS テスト JST 境界案件',
    'published', TIMESTAMP '2000-01-01 00:00:00',
    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date - 1,
    NOW(), NOW()
  );

INSERT INTO public.t_recommendation_log (
  id, user_id, opportunity_id, rank, total_score,
  rule_contributions, reasons, matching_rule_version, created_at
) VALUES
  (
    'a1111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'f8888888-8888-8888-8888-888888888888',
    1, 0.9, '{}'::jsonb, '[]'::jsonb, 'rls-test', NOW()
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'f8888888-8888-8888-8888-888888888888',
    1, 0.8, '{}'::jsonb, '[]'::jsonb, 'rls-test', NOW()
  ),
  (
    'a3333333-3333-3333-3333-333333333333',
    '33333333-3333-3333-3333-333333333333',
    'f2222222-2222-2222-2222-222222222222',
    1, 0.7, '{}'::jsonb, '[]'::jsonb, 'rls-test', NOW()
  ),
  (
    'a4444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    'fc000000-0000-0000-0000-000000000000',
    1, 0.6, '{}'::jsonb, '[]'::jsonb, 'rls-test', NOW()
  );
SQL

# INSERT ポリシーが参照するユーザー状態・参加者プロフィールの境界を用意する。
psql "$database_url" -v ON_ERROR_STOP=1 -X <<'SQL' >/dev/null
INSERT INTO public.m_user (
  id, role, is_active, suspended_at, created_at, updated_at
) VALUES
  (
    '66666666-6666-6666-6666-666666666666',
    'participant', true, NULL, NOW(), NOW()
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'participant', false, NOW(), NOW(), NOW()
  );

INSERT INTO public.m_participant_profile (
  id, user_id, name, birthday, region, public_profile, created_at, updated_at
) VALUES (
  'dddddddd-7777-7777-7777-777777777777',
  '77777777-7777-7777-7777-777777777777',
  'RLS 無効参加者', '2000-01-01', '東京都', true, NOW(), NOW()
);
SQL

psql "$database_url" -v ON_ERROR_STOP=1 -X <<'SQL'
BEGIN;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
DECLARE
  own_count integer;
  other_count integer;
  own_role public.user_role;
BEGIN
  SELECT count(*), max(role)
  INTO own_count, own_role
  FROM public.m_user
  WHERE id = auth.uid();

  SELECT count(*)
  INTO other_count
  FROM public.m_user
  WHERE id = '22222222-2222-2222-2222-222222222222';

  IF own_count <> 1 OR own_role <> 'participant'::public.user_role THEN
    RAISE EXCEPTION 'authenticated user cannot read own m_user role';
  END IF;
  IF other_count <> 0 THEN
    RAISE EXCEPTION 'authenticated user can read another m_user row';
  END IF;
  IF NOT has_column_privilege(
    'authenticated', 'public.m_user', 'id', 'SELECT'
  ) OR NOT has_column_privilege(
    'authenticated', 'public.m_user', 'is_active', 'SELECT'
  ) OR NOT has_column_privilege(
    'authenticated', 'public.m_user', 'role', 'SELECT'
  ) OR NOT has_column_privilege(
    'authenticated', 'public.m_user', 'suspended_at', 'SELECT'
  ) THEN
    RAISE EXCEPTION 'm_user authorization columns lack SELECT privilege';
  END IF;
  IF has_column_privilege('authenticated', 'public.m_user', 'name', 'SELECT') THEN
    RAISE EXCEPTION 'm_user PII column unexpectedly has SELECT privilege';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.t_matching_candidate (
      id, participant_id, opportunity_id, status, message,
      applied_at, status_changed_at, created_at, updated_at
    ) VALUES (
      '77777777-7777-7777-7777-777777777777',
      '33333333-3333-3333-3333-333333333333',
      'f2222222-2222-2222-2222-222222222222',
      'accepted', '不正な初期状態', NOW(), NOW(), NOW(), NOW()
    );
    RAISE EXCEPTION 'participant accepted INSERT unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.t_matching_candidate (
      id, participant_id, opportunity_id, status, message,
      applied_at, status_changed_at, created_at, updated_at
    ) VALUES (
      '88888888-8888-8888-8888-888888888888',
      '33333333-3333-3333-3333-333333333333',
      'f2222222-2222-2222-2222-222222222222',
      'completed', '不正な初期状態', NOW(), NOW(), NOW(), NOW()
    );
    RAISE EXCEPTION 'participant completed INSERT unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

DO $$
DECLARE
  invalid_row record;
BEGIN
  FOR invalid_row IN
    SELECT *
    FROM (
      VALUES
        (
          '90000000-0000-0000-0000-000000000001'::uuid,
          'f9999999-9999-9999-9999-999999999999'::uuid,
          'draft opportunity'
        ),
        (
          '90000000-0000-0000-0000-000000000002'::uuid,
          'fa000000-0000-0000-0000-000000000000'::uuid,
          'future publication'
        ),
        (
          '90000000-0000-0000-0000-000000000003'::uuid,
          'fb000000-0000-0000-0000-000000000000'::uuid,
          'expired opportunity'
        )
    ) AS rows(id, opportunity_id, label)
  LOOP
    BEGIN
      INSERT INTO public.t_matching_candidate (
        id, participant_id, opportunity_id, status, message,
        applied_at, status_changed_at, created_at, updated_at
      ) VALUES (
        invalid_row.id,
        '33333333-3333-3333-3333-333333333333',
        invalid_row.opportunity_id,
        'applied', invalid_row.label, NOW(), NOW(), NOW(), NOW()
      );
      RAISE EXCEPTION '% INSERT unexpectedly succeeded', invalid_row.label;
    EXCEPTION
      WHEN insufficient_privilege OR check_violation THEN
        NULL;
    END;
  END LOOP;
END;
$$;

DO $$
DECLARE
  invalid_row record;
BEGIN
  FOR invalid_row IN
    SELECT *
    FROM (
      VALUES
        (
          '90000000-0000-0000-0000-000000000011'::uuid,
          'a2222222-2222-2222-2222-222222222222'::uuid,
          'other participant recommendation'
        ),
        (
          '90000000-0000-0000-0000-000000000012'::uuid,
          'a3333333-3333-3333-3333-333333333333'::uuid,
          'different opportunity recommendation'
        )
    ) AS rows(id, recommendation_log_id, label)
  LOOP
    BEGIN
      INSERT INTO public.t_matching_candidate (
        id, participant_id, opportunity_id, recommendation_log_id,
        status, message, applied_at, status_changed_at, created_at, updated_at
      ) VALUES (
        invalid_row.id,
        '33333333-3333-3333-3333-333333333333',
        'f8888888-8888-8888-8888-888888888888',
        invalid_row.recommendation_log_id,
        'applied', invalid_row.label, NOW(), NOW(), NOW(), NOW()
      );
      RAISE EXCEPTION '% INSERT unexpectedly succeeded', invalid_row.label;
    EXCEPTION
      WHEN insufficient_privilege OR check_violation THEN
        NULL;
    END;
  END LOOP;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.t_matching_candidate (
      id, participant_id, opportunity_id, status, message,
      applied_at, status_changed_at, created_at, updated_at
    ) VALUES (
      '90000000-0000-0000-0000-000000000031',
      '44444444-4444-4444-4444-444444444444',
      'f8888888-8888-8888-8888-888888888888',
      'applied', 'organization user',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00'
    );
    RAISE EXCEPTION 'organization user INSERT unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.t_matching_candidate (
      id, participant_id, opportunity_id, status, message,
      applied_at, status_changed_at, created_at, updated_at
    ) VALUES (
      '90000000-0000-0000-0000-000000000032',
      '66666666-6666-6666-6666-666666666666',
      'f8888888-8888-8888-8888-888888888888',
      'applied', 'participant without profile',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00'
    );
    RAISE EXCEPTION 'participant without profile INSERT unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.t_matching_candidate (
      id, participant_id, opportunity_id, status, message,
      applied_at, status_changed_at, created_at, updated_at
    ) VALUES (
      '90000000-0000-0000-0000-000000000033',
      '77777777-7777-7777-7777-777777777777',
      'f8888888-8888-8888-8888-888888888888',
      'applied', 'inactive participant',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00'
    );
    RAISE EXCEPTION 'inactive participant INSERT unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

SET LOCAL TIME ZONE 'Asia/Tokyo';
SELECT set_config('TimeZone', '+15:00', true);

DO $$
DECLARE
  boundary_opportunity record;
  participant_is_valid boolean;
  recommendation_is_valid boolean;
BEGIN
  SELECT status, published_at, end_date
  INTO boundary_opportunity
  FROM public.m_opportunity
  WHERE id = 'fc000000-0000-0000-0000-000000000000';

  IF boundary_opportunity.status <> 'published'::public.opportunity_status
     OR boundary_opportunity.published_at IS NULL
     OR boundary_opportunity.published_at > CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'JST boundary opportunity is not otherwise published and public';
  END IF;
  IF CURRENT_DATE <> boundary_opportunity.end_date THEN
    RAISE EXCEPTION 'JST boundary precondition does not satisfy old CURRENT_DATE predicate';
  END IF;
  IF (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date
       <= boundary_opportunity.end_date THEN
    RAISE EXCEPTION 'JST boundary precondition is not expired in Asia/Tokyo';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.m_user AS participant_user
    JOIN public.m_participant_profile AS participant_profile
      ON participant_profile.user_id = participant_user.id
    WHERE participant_user.id = auth.uid()
      AND participant_user.role = 'participant'::public.user_role
      AND participant_user.is_active IS TRUE
      AND participant_user.suspended_at IS NULL
  )
  INTO participant_is_valid;
  IF NOT participant_is_valid THEN
    RAISE EXCEPTION 'JST boundary participant/profile precondition is invalid';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.t_recommendation_log AS recommendation_log
    WHERE recommendation_log.id =
        'a4444444-4444-4444-4444-444444444444'
      AND recommendation_log.user_id = auth.uid()
      AND recommendation_log.opportunity_id =
        'fc000000-0000-0000-0000-000000000000'
  )
  INTO recommendation_is_valid;
  IF NOT recommendation_is_valid THEN
    RAISE EXCEPTION 'JST boundary recommendation precondition is invalid';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.t_matching_candidate (
      id, participant_id, opportunity_id, recommendation_log_id,
      status, message,
      applied_at, status_changed_at, created_at, updated_at
    ) VALUES (
      '90000000-0000-0000-0000-000000000041',
      '33333333-3333-3333-3333-333333333333',
      'fc000000-0000-0000-0000-000000000000',
      'a4444444-4444-4444-4444-444444444444',
      'applied', 'JST boundary',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00',
      TIMESTAMP '2000-01-01 00:00:00+00'
    );
    RAISE EXCEPTION 'JST-expired opportunity INSERT unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

SELECT set_config('TimeZone', 'Asia/Tokyo', true);

INSERT INTO public.t_matching_candidate (
  id, participant_id, opportunity_id, recommendation_log_id,
  status, message, applied_at, status_changed_at, created_at, updated_at
) VALUES (
  '90000000-0000-0000-0000-000000000021',
  '33333333-3333-3333-3333-333333333333',
  'f8888888-8888-8888-8888-888888888888',
  'a1111111-1111-1111-1111-111111111111',
  'applied', 'own recommendation', NOW(), NOW(), NOW(), NOW()
);

INSERT INTO public.t_matching_candidate (
  id, participant_id, opportunity_id, status, message,
  applied_at, status_changed_at, created_at, updated_at
) VALUES (
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  'f2222222-2222-2222-2222-222222222222',
  'applied', '正常な応募', TIMESTAMP '2000-01-01 00:00:00+00',
  TIMESTAMP '2000-01-01 00:00:00+00', TIMESTAMP '2000-01-01 00:00:00+00',
  TIMESTAMP '2000-01-01 00:00:00+00'
);

DO $$
DECLARE
  applied_at_value timestamptz;
  status_changed_at_value timestamptz;
  created_at_value timestamptz;
  updated_at_value timestamptz;
BEGIN
  SELECT applied_at, status_changed_at, created_at, updated_at
  INTO applied_at_value, status_changed_at_value, created_at_value, updated_at_value
  FROM public.t_matching_candidate
  WHERE id = '66666666-6666-6666-6666-666666666666';

  IF applied_at_value IS NULL
     OR applied_at_value <= TIMESTAMP '2020-01-01 00:00:00+00'
     OR status_changed_at_value <= TIMESTAMP '2020-01-01 00:00:00+00'
     OR created_at_value <= TIMESTAMP '2020-01-01 00:00:00+00'
     OR updated_at_value <= TIMESTAMP '2020-01-01 00:00:00+00' THEN
    RAISE EXCEPTION 'INSERT timestamps were not set by the database';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

DO $$
BEGIN
  BEGIN
    UPDATE public.t_matching_candidate
    SET participant_id = '22222222-2222-2222-2222-222222222222'
    WHERE id = '66666666-6666-6666-6666-666666666666';
    RAISE EXCEPTION 'organization participant_id UPDATE unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.t_matching_candidate
    SET opportunity_id = 'f1111111-1111-1111-1111-111111111111'
    WHERE id = '66666666-6666-6666-6666-666666666666';
    RAISE EXCEPTION 'organization opportunity_id UPDATE unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

DO $$
DECLARE
  changed_at timestamptz;
  updated_at_value timestamptz;
BEGIN
  UPDATE public.t_matching_candidate
  SET status = 'accepted',
      status_changed_at = TIMESTAMP '2000-01-01 00:00:00+00',
      updated_at = TIMESTAMP '2000-01-01 00:00:00+00'
  WHERE id = '66666666-6666-6666-6666-666666666666';

  SELECT status_changed_at, updated_at
  INTO changed_at, updated_at_value
  FROM public.t_matching_candidate
  WHERE id = '66666666-6666-6666-6666-666666666666';

  IF changed_at <= TIMESTAMP '2020-01-01 00:00:00+00'
     OR updated_at_value <= TIMESTAMP '2020-01-01 00:00:00+00' THEN
    RAISE EXCEPTION 'status transition timestamps were not set by the database';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.t_matching_candidate
    SET status = 'accepted',
        status_changed_at = TIMESTAMP '2000-01-01 00:00:00+00',
        updated_at = TIMESTAMP '2000-01-01 00:00:00+00'
    WHERE id = '66666666-6666-6666-6666-666666666666';
    RAISE EXCEPTION 'same-status timestamp UPDATE unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

DO $$
DECLARE
  previous_changed_at timestamptz;
  completed_at timestamptz;
BEGIN
  SELECT status_changed_at
  INTO previous_changed_at
  FROM public.t_matching_candidate
  WHERE id = '66666666-6666-6666-6666-666666666666';

  UPDATE public.t_matching_candidate
  SET status = 'completed',
      status_changed_at = TIMESTAMP '2000-01-01 00:00:00+00',
      updated_at = TIMESTAMP '2000-01-01 00:00:00+00'
  WHERE id = '66666666-6666-6666-6666-666666666666';

  SELECT status_changed_at
  INTO completed_at
  FROM public.t_matching_candidate
  WHERE id = '66666666-6666-6666-6666-666666666666';

  IF completed_at <= previous_changed_at THEN
    RAISE EXCEPTION 'completed status timestamp was not advanced by the database';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.t_matching_candidate
    SET status = 'completed', status_changed_at = NOW(), updated_at = NOW()
    WHERE participant_id = '11111111-1111-1111-1111-111111111111'
      AND opportunity_id = 'f1111111-1111-1111-1111-111111111111'
      AND status = 'applied';
    RAISE EXCEPTION 'organization applied-to-completed UPDATE unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.t_matching_candidate
    SET status = 'cancelled', status_changed_at = NOW(), updated_at = NOW()
    WHERE participant_id = '11111111-1111-1111-1111-111111111111'
      AND opportunity_id = 'f1111111-1111-1111-1111-111111111111'
      AND status = 'applied';
    RAISE EXCEPTION 'organization applied-to-cancelled UPDATE unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure(
    'public.matching_candidate_status_update_allowed(uuid,public.matching_status)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'public status oracle function unexpectedly remains';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'public.matching_candidate_before_update()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'trigger function unexpectedly has authenticated EXECUTE';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'public.matching_candidate_before_insert()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'insert trigger function unexpectedly has authenticated EXECUTE';
  END IF;
  IF NOT has_column_privilege(
    'authenticated',
    'public.t_matching_candidate',
    'status_changed_at',
    'UPDATE'
  ) OR NOT has_column_privilege(
    'authenticated',
    'public.t_matching_candidate',
    'updated_at',
    'UPDATE'
  ) THEN
    RAISE EXCEPTION 'Server Action timestamp columns lack authenticated UPDATE privilege';
  END IF;
END;
$$;

ROLLBACK;
SQL

# 2接続で同じ applied 行を競合更新する。接続Aの未コミット UPDATE を
# idle in transaction として確認してから、接続Bが行ロック待ちになったことを
# pg_stat_activity で確認し、AをCOMMITする。固定sleepを同期条件にしない。
race_id="91000000-0000-0000-0000-000000000001"
psql "$database_url" -v ON_ERROR_STOP=1 -X -c "
  INSERT INTO public.t_matching_candidate (
    id, participant_id, opportunity_id, status, message,
    applied_at, status_changed_at, created_at, updated_at
  ) VALUES (
    '$race_id',
    '33333333-3333-3333-3333-333333333333',
    'f2222222-2222-2222-2222-222222222222',
    'applied', '競合テスト', NOW(), NOW(), NOW(), NOW()
  )
" >/dev/null

race_fifo="$test_tmp/race-a.sql"
mkfifo "$race_fifo"
race_a_url="$database_url?application_name=volunty-rls-race-a"
psql "$race_a_url" -v ON_ERROR_STOP=1 -X \
  <"$race_fifo" >"$test_tmp/race-a.log" 2>&1 &
race_a_pid=$!
exec {race_a_fd}>"$race_fifo"
printf '%s\n' \
  'BEGIN;' \
  'SET LOCAL ROLE authenticated;' \
  "SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);" \
  "UPDATE public.t_matching_candidate SET status = 'accepted' WHERE id = '$race_id';" \
  >&"$race_a_fd"

race_a_ready=false
for _ in $(seq 1 200); do
  race_a_state="$(psql "$database_url" -AtX -c "
    SELECT state
    FROM pg_stat_activity
    WHERE application_name = 'volunty-rls-race-a'
      AND state = 'idle in transaction'
    LIMIT 1
  ")"
  if [ "$race_a_state" = "idle in transaction" ]; then
    race_a_ready=true
    break
  fi
  sleep 0.01
done
if [ "$race_a_ready" != true ]; then
  printf '競合テストの接続Aが未コミット状態になりませんでした\n' >&2
  cat "$test_tmp/race-a.log" >&2
  exit 1
fi

race_b_url="$database_url?application_name=volunty-rls-race-b"
psql "$race_b_url" -v ON_ERROR_STOP=1 -X >"$test_tmp/race-b.log" 2>&1 <<SQL &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
DO \$\$
BEGIN
  BEGIN
    UPDATE public.t_matching_candidate
    SET status = 'declined'
    WHERE id = '$race_id';
    RAISE EXCEPTION 'concurrent applied-to-declined UPDATE unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
  END;
END;
\$\$;
COMMIT;
SQL
race_b_pid=$!

race_b_waiting=false
for _ in $(seq 1 200); do
  race_b_wait_event="$(psql "$database_url" -AtX -c "
    SELECT COALESCE(wait_event_type, '')
    FROM pg_stat_activity
    WHERE application_name = 'volunty-rls-race-b'
      AND state = 'active'
    LIMIT 1
  ")"
  if [ "$race_b_wait_event" = "Lock" ]; then
    race_b_waiting=true
    break
  fi
  sleep 0.01
done
if [ "$race_b_waiting" != true ]; then
  printf '競合テストの接続Bが行ロック待ちになりませんでした\n' >&2
  cat "$test_tmp/race-b.log" >&2
  exit 1
fi

printf 'COMMIT;\n' >&"$race_a_fd"
eval "exec ${race_a_fd}>&-"
race_a_fd=""
if ! wait "$race_a_pid"; then
  printf '競合テストの接続Aが失敗しました\n' >&2
  cat "$test_tmp/race-a.log" >&2
  exit 1
fi
race_a_pid=""

if ! wait "$race_b_pid"; then
  printf '競合テストの接続Bが失敗しました\n' >&2
  cat "$test_tmp/race-b.log" >&2
  exit 1
fi
race_b_pid=""

race_status="$(psql "$database_url" -AtX -c "
  SELECT status
  FROM public.t_matching_candidate
  WHERE id = '$race_id'
")"
if [ "$race_status" != "accepted" ]; then
  printf '競合テスト後のstatusが不正です: %s\n' "$race_status" >&2
  exit 1
fi

printf 'RLS DML tests passed\n'

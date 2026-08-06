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
pg_ctl -D "$data_dir" -o "-p $port" -l "$test_tmp/postgres.log" -w start >/dev/null

createdb_command="$(command -v createdb || true)"
if [ -z "$createdb_command" ]; then
  psql "$database_url" -v ON_ERROR_STOP=1 -X -c "CREATE DATABASE $database_name" >/dev/null
else
  "$createdb_command" -p "$port" "$database_name" >/dev/null
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
    'published', NOW() - INTERVAL '1 minute',
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
SELECT set_config('TimeZone', '-15:00', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.t_matching_candidate (
      id, participant_id, opportunity_id, status, message,
      applied_at, status_changed_at, created_at, updated_at
    ) VALUES (
      '90000000-0000-0000-0000-000000000041',
      '33333333-3333-3333-3333-333333333333',
      'fc000000-0000-0000-0000-000000000000',
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

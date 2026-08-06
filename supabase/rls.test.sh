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

cleanup() {
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

INSERT INTO public.t_matching_candidate (
  id, participant_id, opportunity_id, status, message,
  applied_at, status_changed_at, created_at, updated_at
) VALUES (
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  'f2222222-2222-2222-2222-222222222222',
  'applied', '正常な応募', NOW(), NOW(), NOW(), NOW()
);

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

UPDATE public.t_matching_candidate
SET status = 'accepted', status_changed_at = NOW(), updated_at = NOW()
WHERE id = '66666666-6666-6666-6666-666666666666';

UPDATE public.t_matching_candidate
SET status = 'completed', status_changed_at = NOW(), updated_at = NOW()
WHERE id = '66666666-6666-6666-6666-666666666666';

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

ROLLBACK;
SQL

printf 'RLS DML tests passed\n'

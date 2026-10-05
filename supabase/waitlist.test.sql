-- rls.test.shが作成する使い捨てDBだけで実行する。
BEGIN;
DO $$
DECLARE target_role text; target_table text; privilege text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH target_table IN ARRAY ARRAY['t_waitlist_entry'] LOOP
      FOREACH privilege IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
        IF has_table_privilege(target_role, 'public.' || target_table, privilege) THEN
          RAISE EXCEPTION '待機リストの権限が公開されています: % % %', target_role, target_table, privilege;
        END IF;
      END LOOP;
      IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || target_table)::regclass) THEN
        RAISE EXCEPTION '待機リストのRLSが無効です: %', target_table;
      END IF;
    END LOOP;
  END LOOP;

  INSERT INTO public.t_waitlist_entry(email) VALUES ('waitlist-contract@example.com') ON CONFLICT DO NOTHING;
  INSERT INTO public.t_waitlist_entry(email) VALUES ('waitlist-contract@example.com') ON CONFLICT DO NOTHING;
  IF (SELECT count(*) FROM public.t_waitlist_entry WHERE email = 'waitlist-contract@example.com') <> 1 THEN
    RAISE EXCEPTION '待機リストの重複排除に失敗しました';
  END IF;

END;
$$;
ROLLBACK;

-- 保持期限はUTCの暦年・30日。既登録日時を基準にし、境界の直前は残す。
BEGIN;
SET LOCAL TIME ZONE 'UTC';
INSERT INTO public.t_waitlist_entry(email, created_at, notified_at) VALUES
  ('year-due@example.com', '2025-10-05 12:00:00+00', NULL),
  ('year-before@example.com', '2025-10-05 12:00:00.000001+00', NULL),
  ('notice-due@example.com', '2026-01-01 00:00:00+00', '2026-09-05 12:00:00+00'),
  ('notice-before@example.com', '2026-01-01 00:00:00+00', '2026-09-05 12:00:00.000001+00'),
  ('year-first@example.com', '2025-10-05 12:00:00+00', '2026-10-01 00:00:00+00'),
  ('recent-unnotified@example.com', '2026-10-01 00:00:00+00', NULL);
DO $$
DECLARE removed integer;
BEGIN
  IF TIMESTAMPTZ '2024-02-29 12:00:00+00' + INTERVAL '1 year'
      <> TIMESTAMPTZ '2025-02-28 12:00:00+00' THEN
    RAISE EXCEPTION 'うるう日の暦年期限が不正です';
  END IF;
  WITH cutoff AS (SELECT TIMESTAMPTZ '2026-10-05 12:00:00+00' AS at), deleted AS (
    DELETE FROM public.t_waitlist_entry USING cutoff
    WHERE created_at + INTERVAL '1 year' <= cutoff.at
       OR notified_at + INTERVAL '30 days' <= cutoff.at
    RETURNING id
  ) SELECT count(*) INTO removed FROM deleted;
  IF removed <> 3 THEN
    RAISE EXCEPTION '保持期限による削除件数が不正です: %', removed;
  END IF;
  IF (SELECT count(*) FROM public.t_waitlist_entry WHERE email IN (
      'year-before@example.com', 'notice-before@example.com', 'recent-unnotified@example.com')) <> 3 THEN
    RAISE EXCEPTION '保持期限前の登録が削除されました';
  END IF;
END;
$$;
ROLLBACK;

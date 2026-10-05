-- rls.test.shが作成する使い捨てDBだけで実行する。
BEGIN;
DO $$
DECLARE target_role text; target_table text; privilege text; counter integer;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH target_table IN ARRAY ARRAY['t_waitlist_entry', 't_waitlist_rate_limit'] LOOP
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

  FOR attempt IN 1..12 LOOP
    counter := NULL;
    INSERT INTO public.t_waitlist_rate_limit(key, window_start, expires_at, count)
    VALUES ('waitlist-contract-ip-hash', '2026-10-05 00:45:00+00', '2026-10-05 01:00:00+00', 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = public.t_waitlist_rate_limit.count + 1
      WHERE public.t_waitlist_rate_limit.count < 10
    RETURNING count INTO counter;
    IF (attempt <= 10 AND counter IS DISTINCT FROM attempt) OR (attempt > 10 AND counter IS NOT NULL) THEN
      RAISE EXCEPTION '待機リストの送信上限に失敗しました: %', attempt;
    END IF;
  END LOOP;
END;
$$;
ROLLBACK;

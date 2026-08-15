-- Issue #199: Data API が public schema 内の許可済みオブジェクトへ到達できるようにする。
-- テーブル単位の最小権限と RLS は各 migration で個別に管理する。
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- server-side Prisma専用テーブルはSupabase既定ACLに依存せずData APIから閉じる。
DO $$
DECLARE
  protected_table TEXT;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    '_prisma_migrations',
    'm_message_template',
    'm_personality_type',
    't_diagnosis_response',
    't_recommendation_log',
    't_engagement_event',
    't_participation_feedback',
    't_approach',
    't_certificate'
  ]
  LOOP
    IF to_regclass(format('public.%I', protected_table)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.%I FROM anon, authenticated',
        protected_table
      );
    END IF;
  END LOOP;
END;
$$;

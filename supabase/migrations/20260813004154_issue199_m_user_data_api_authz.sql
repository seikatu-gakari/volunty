-- Issue #199: proxy の m_user ロール参照を Supabase Data API で許可する。
-- 認証済みユーザーは本人の認可用列だけを参照できる。
ALTER TABLE public.m_user ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.m_user FROM anon, authenticated;
GRANT SELECT (id, is_active, role, suspended_at) ON TABLE public.m_user TO authenticated;

DROP POLICY IF EXISTS "ユーザーは自分のデータを閲覧可能" ON public.m_user;
CREATE POLICY "ユーザーは自分のデータを閲覧可能"
  ON public.m_user
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

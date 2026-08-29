-- Issue #230: 適用済みmigrationへの後追い変更で欠落した案件Data API認可を復旧する。
ALTER TABLE public.m_opportunity ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.m_opportunity FROM anon, authenticated;
GRANT SELECT ON TABLE public.m_opportunity TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.m_opportunity TO authenticated;

DROP POLICY IF EXISTS "公開済み案件は全員閲覧可能"
  ON public.m_opportunity;
CREATE POLICY "公開済み案件は全員閲覧可能"
  ON public.m_opportunity
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published'::public.opportunity_status);

DROP POLICY IF EXISTS "団体は自分の案件を閲覧可能"
  ON public.m_opportunity;
CREATE POLICY "団体は自分の案件を閲覧可能"
  ON public.m_opportunity
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT id
      FROM public.m_organization_profile
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "団体は自分の案件を作成可能"
  ON public.m_opportunity;
CREATE POLICY "団体は自分の案件を作成可能"
  ON public.m_opportunity
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT id
      FROM public.m_organization_profile
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "団体は自分の案件を更新可能"
  ON public.m_opportunity;
CREATE POLICY "団体は自分の案件を更新可能"
  ON public.m_opportunity
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT id
      FROM public.m_organization_profile
      WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT id
      FROM public.m_organization_profile
      WHERE user_id = (select auth.uid())
    )
  );

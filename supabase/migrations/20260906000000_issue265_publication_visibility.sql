-- Issue #265: 公開案件は公開日時が設定済みで、公開日時を過ぎたものだけに限定する。
DROP POLICY IF EXISTS "公開済み案件は全員閲覧可能"
  ON public.m_opportunity;
CREATE POLICY "公開済み案件は全員閲覧可能"
  ON public.m_opportunity
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'::public.opportunity_status
    AND published_at IS NOT NULL
    AND published_at <= now()
  );

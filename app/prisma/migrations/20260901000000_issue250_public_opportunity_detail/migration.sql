ALTER TABLE "m_opportunity"
  ADD COLUMN "schedule" TEXT,
  ADD COLUMN "cost" TEXT,
  ADD COLUMN "belongings" TEXT,
  ADD COLUMN "application_deadline" DATE,
  ADD COLUMN "cancellation_policy" TEXT,
  ADD COLUMN "insurance_details" TEXT,
  ADD COLUMN "contact_method" TEXT;

-- 匿名・一般参加者が未来公開をData APIから直接取得できないよう公開条件を統一する。
DROP POLICY IF EXISTS "公開済み案件は全員閲覧可能" ON public.m_opportunity;
CREATE POLICY "公開済み案件は全員閲覧可能"
  ON public.m_opportunity
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'::public.opportunity_status
    AND published_at IS NOT NULL
    AND published_at <= now()
  );

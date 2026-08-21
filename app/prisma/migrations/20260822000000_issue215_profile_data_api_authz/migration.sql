-- Issue #215: オンボーディングが参照するプロフィールのData API認可を復元する。
-- 参加者は本人のみ、団体は承認済みまたは本人のプロフィールのみ参照できる。
ALTER TABLE public.m_participant_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m_organization_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "参加者は自分のプロフィールを閲覧可能"
  ON public.m_participant_profile;
CREATE POLICY "参加者は自分のプロフィールを閲覧可能"
  ON public.m_participant_profile
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "認証済み団体は全員閲覧可能"
  ON public.m_organization_profile;
CREATE POLICY "認証済み団体は全員閲覧可能"
  ON public.m_organization_profile
  FOR SELECT
  TO anon, authenticated
  USING (
    review_status = 'approved'
    OR verified = true
    OR (select auth.uid()) = user_id
  );

REVOKE ALL ON TABLE public.m_participant_profile
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.m_participant_profile TO authenticated;

REVOKE ALL ON TABLE public.m_organization_profile
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.m_organization_profile TO anon, authenticated;

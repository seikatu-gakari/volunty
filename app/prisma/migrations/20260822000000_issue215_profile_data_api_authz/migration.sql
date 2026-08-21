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
REVOKE SELECT (
  id, user_id, organization_name, representative_name, contact_email,
  activity_areas, description, activity_categories, website_url, logo_url,
  contact_line_id, contact_line_url, review_status, review_comment,
  reviewed_at, reviewed_by, verified, profile_completeness, created_at,
  updated_at
)
  ON TABLE public.m_organization_profile
  FROM anon, authenticated;

-- Data API consumerが必要とする公開・判定列だけを匿名ロールへ公開する。
GRANT SELECT (
  id, organization_name, description, verified, review_status
)
  ON TABLE public.m_organization_profile
  TO anon;

-- 認証済みの所有者照会と参加者向け案件表示に必要な列だけを許可する。
GRANT SELECT (
  id, user_id, organization_name, description, verified, review_status,
  contact_line_id, reviewed_at, profile_completeness
)
  ON TABLE public.m_organization_profile
  TO authenticated;

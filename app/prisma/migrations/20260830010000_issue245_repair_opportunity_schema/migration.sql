-- Issue #245: 旧本番schemaに欠落した案件作成payload列を非破壊で復旧する。
ALTER TABLE public.m_opportunity
  ADD COLUMN IF NOT EXISTS activity_style_tags JSONB,
  ADD COLUMN IF NOT EXISTS required_qualifications JSONB,
  ADD COLUMN IF NOT EXISTS min_age INTEGER,
  ADD COLUMN IF NOT EXISTS max_age INTEGER;

NOTIFY pgrst, 'reload schema';

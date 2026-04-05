-- ============================================
-- Supabase Auth → m_user 同期トリガー
-- ============================================
-- Supabase Auth でユーザーが作成されたとき、自動的に m_user テーブルにレコードを作成する。
-- Supabase Dashboard の SQL Editor で実行してください。
--
-- 注意: Prisma マイグレーション後に実行すること（m_user テーブルが存在する必要がある）
-- ============================================

-- 1. トリガー関数: auth.users → public.m_user への同期
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.m_user (id, email, name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. トリガー: auth.users に INSERT されたとき発火
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- RLS（Row Level Security）ポリシー
-- ============================================
-- Supabase では RLS が推奨される。各テーブルにポリシーを設定。

-- m_user: 自分のレコードのみ読み取り・更新可能
ALTER TABLE public.m_user ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ユーザーは自分のデータを閲覧可能"
  ON public.m_user FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "ユーザーは自分のデータを更新可能"
  ON public.m_user FOR UPDATE
  USING (auth.uid() = id);

-- m_participant_profile: 自分のプロフィールのみ CRUD 可能
ALTER TABLE public.m_participant_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "参加者は自分のプロフィールを閲覧可能"
  ON public.m_participant_profile FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "参加者は自分のプロフィールを作成可能"
  ON public.m_participant_profile FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "参加者は自分のプロフィールを更新可能"
  ON public.m_participant_profile FOR UPDATE
  USING (user_id = auth.uid());

-- m_organization_profile: 自分の団体プロフィールのみ CRUD + 公開情報は全員閲覧可能
ALTER TABLE public.m_organization_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "認証済み団体は全員閲覧可能"
  ON public.m_organization_profile FOR SELECT
  USING (verified = true OR user_id = auth.uid());

CREATE POLICY "団体は自分のプロフィールを作成可能"
  ON public.m_organization_profile FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "団体は自分のプロフィールを更新可能"
  ON public.m_organization_profile FOR UPDATE
  USING (user_id = auth.uid());

-- m_opportunity: 公開済み案件は全員閲覧可能 + 団体は自分の案件を CRUD
ALTER TABLE public.m_opportunity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "公開済み案件は全員閲覧可能"
  ON public.m_opportunity FOR SELECT
  USING (
    status = 'published'
    OR organization_id IN (
      SELECT id FROM public.m_organization_profile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "団体は自分の案件を作成可能"
  ON public.m_opportunity FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT id FROM public.m_organization_profile WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "団体は自分の案件を更新可能"
  ON public.m_opportunity FOR UPDATE
  USING (
    organization_id IN (
      SELECT id FROM public.m_organization_profile WHERE user_id = auth.uid()
    )
  );

-- t_diagnosis_result: 自分の結果のみ閲覧可能
ALTER TABLE public.t_diagnosis_result ENABLE ROW LEVEL SECURITY;

CREATE POLICY "参加者は自分の診断結果を閲覧可能"
  ON public.t_diagnosis_result FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "参加者は自分の診断結果を作成可能"
  ON public.t_diagnosis_result FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- t_matching_candidate: 参加者は自分の応募を閲覧 + 団体は自分の案件の応募を閲覧
ALTER TABLE public.t_matching_candidate ENABLE ROW LEVEL SECURITY;

CREATE POLICY "参加者は自分の応募を閲覧可能"
  ON public.t_matching_candidate FOR SELECT
  USING (participant_id = auth.uid());

CREATE POLICY "団体は自分の案件の応募を閲覧可能"
  ON public.t_matching_candidate FOR SELECT
  USING (
    opportunity_id IN (
      SELECT o.id FROM public.m_opportunity o
      JOIN public.m_organization_profile org ON o.organization_id = org.id
      WHERE org.user_id = auth.uid()
    )
  );

CREATE POLICY "参加者は応募を作成可能"
  ON public.t_matching_candidate FOR INSERT
  WITH CHECK (participant_id = auth.uid());

CREATE POLICY "団体は応募ステータスを更新可能"
  ON public.t_matching_candidate FOR UPDATE
  USING (
    opportunity_id IN (
      SELECT o.id FROM public.m_opportunity o
      JOIN public.m_organization_profile org ON o.organization_id = org.id
      WHERE org.user_id = auth.uid()
    )
  );

-- m_personality_type: 全員読み取り可能（マスタデータ）
ALTER TABLE public.m_personality_type ENABLE ROW LEVEL SECURITY;

CREATE POLICY "人物タイプマスタは全員閲覧可能"
  ON public.m_personality_type FOR SELECT
  USING (true);

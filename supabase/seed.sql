-- ============================================
-- Supabase ローカル開発用シードSQL
-- ============================================
-- supabase db reset 実行時にマイグレーション後に自動適用される。
-- Auth トリガー・RLS ポリシーをローカル環境にも反映する。
-- スキーマは app/prisma/schema.prisma（2026-07 再設計版）準拠。
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
-- アプリは Prisma 直接続（RLS対象外ロール）で動作するため、
-- これらは anon / authenticated 経由の直接アクセスに対する防御層。

-- m_user: 自分のレコードのみ読み取り・更新可能
ALTER TABLE public.m_user ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ユーザーは自分のデータを閲覧可能" ON public.m_user;
CREATE POLICY "ユーザーは自分のデータを閲覧可能"
  ON public.m_user FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "ユーザーは自分のデータを更新可能"
  ON public.m_user FOR UPDATE
  USING (auth.uid() = id);

-- m_participant_profile: Data APIは自分のプロフィールのみ参照可能
-- 書き込みはserver-side Prisma経由で行う。
ALTER TABLE public.m_participant_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "参加者は自分のプロフィールを閲覧可能"
  ON public.m_participant_profile;
CREATE POLICY "参加者は自分のプロフィールを閲覧可能"
  ON public.m_participant_profile FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "参加者は自分のプロフィールを作成可能"
  ON public.m_participant_profile;
CREATE POLICY "参加者は自分のプロフィールを作成可能"
  ON public.m_participant_profile FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "参加者は自分のプロフィールを更新可能"
  ON public.m_participant_profile;
CREATE POLICY "参加者は自分のプロフィールを更新可能"
  ON public.m_participant_profile FOR UPDATE
  USING (user_id = auth.uid());

-- m_organization_profile: 承認済みまたは本人のプロフィールのみ参照可能
-- 書き込みはserver-side Prisma経由で行う。
ALTER TABLE public.m_organization_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "認証済み団体は全員閲覧可能"
  ON public.m_organization_profile;
CREATE POLICY "認証済み団体は全員閲覧可能"
  ON public.m_organization_profile FOR SELECT
  USING (
    review_status = 'approved'
    OR verified = true
    OR (select auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "団体は自分のプロフィールを作成可能"
  ON public.m_organization_profile;
CREATE POLICY "団体は自分のプロフィールを作成可能"
  ON public.m_organization_profile FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "団体は自分のプロフィールを更新可能"
  ON public.m_organization_profile;
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

-- t_diagnosis_result: 本人のみ閲覧・作成可能（生スコアは他者へ開示しない）
ALTER TABLE public.t_diagnosis_result ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "参加者は自分の診断結果を閲覧可能"
  ON public.t_diagnosis_result;
CREATE POLICY "参加者は自分の診断結果を閲覧可能"
  ON public.t_diagnosis_result FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "参加者は自分の診断結果を作成可能"
  ON public.t_diagnosis_result;
CREATE POLICY "参加者は自分の診断結果を作成可能"
  ON public.t_diagnosis_result FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- t_diagnosis_response: 本人のみ閲覧可能（同意ベースの生回答）
ALTER TABLE public.t_diagnosis_response ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "参加者は自分の生回答を閲覧可能"
  ON public.t_diagnosis_response;
CREATE POLICY "参加者は自分の生回答を閲覧可能"
  ON public.t_diagnosis_response FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.t_diagnosis_result r
      WHERE r.id = diagnosis_result_id AND r.user_id = auth.uid()
    )
  );

-- t_recommendation_log: 本人のみ閲覧可能
ALTER TABLE public.t_recommendation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "参加者は自分の推薦ログを閲覧可能"
  ON public.t_recommendation_log FOR SELECT
  USING (user_id = auth.uid());

-- t_engagement_event: 本人のみ閲覧可能
ALTER TABLE public.t_engagement_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "参加者は自分のイベントを閲覧可能"
  ON public.t_engagement_event FOR SELECT
  USING (user_id = auth.uid());

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
  WITH CHECK (
    participant_id = auth.uid()
    AND status = 'applied'::public.matching_status
    AND EXISTS (
      SELECT 1
      FROM public.m_user AS participant_user
      JOIN public.m_participant_profile AS participant_profile
        ON participant_profile.user_id = participant_user.id
      WHERE participant_user.id = public.t_matching_candidate.participant_id
        AND participant_user.role = 'participant'::public.user_role
        AND participant_user.is_active IS TRUE
        AND participant_user.suspended_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.m_opportunity AS opportunity
      WHERE opportunity.id = public.t_matching_candidate.opportunity_id
        AND opportunity.status = 'published'::public.opportunity_status
        AND opportunity.published_at IS NOT NULL
        AND opportunity.published_at <= CURRENT_TIMESTAMP
        AND (
          opportunity.end_date IS NULL
          OR opportunity.end_date >=
            (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date
        )
    )
    AND (
      recommendation_log_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.t_recommendation_log AS recommendation_log
        WHERE recommendation_log.id = public.t_matching_candidate.recommendation_log_id
          AND recommendation_log.user_id = auth.uid()
          AND recommendation_log.opportunity_id = public.t_matching_candidate.opportunity_id
      )
    )
  );

-- PostgREST経由のINSERTでクライアントが監査日時を偽装できないようにする。
CREATE OR REPLACE FUNCTION public.matching_candidate_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Prismaの直接接続（RLS対象外ロール）はE2E fixtureの状態投入を継続する。
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  NEW.applied_at := clock_timestamp();
  NEW.status_changed_at := clock_timestamp();
  NEW.created_at := clock_timestamp();
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.matching_candidate_before_insert() FROM PUBLIC;
DROP TRIGGER IF EXISTS matching_candidate_before_insert
  ON public.t_matching_candidate;
CREATE TRIGGER matching_candidate_before_insert
  BEFORE INSERT ON public.t_matching_candidate
  FOR EACH ROW
  EXECUTE FUNCTION public.matching_candidate_before_insert();

-- 団体による応募ステータス変更は、画面で定義した遷移だけを許可する。
-- RLSポリシーのスナップショットではなく、UPDATEのOLD/NEWを比較する
-- BEFOREトリガーで競合時も遷移を再検証する。
CREATE OR REPLACE FUNCTION public.matching_candidate_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Prismaの直接接続（RLS対象外ロール）はE2E fixtureの状態投入を継続する。
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = OLD.status THEN
    IF NEW.status_changed_at IS DISTINCT FROM OLD.status_changed_at
       OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
      RAISE EXCEPTION '応募ステータスが変わらない更新では日時を変更できません'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    (
      OLD.status = 'applied'::public.matching_status
      AND NEW.status IN (
        'accepted'::public.matching_status,
        'declined'::public.matching_status
      )
    )
    OR (
      OLD.status = 'accepted'::public.matching_status
      AND NEW.status = 'completed'::public.matching_status
    )
  ) THEN
    RAISE EXCEPTION '応募ステータスの遷移が許可されていません'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.status_changed_at := clock_timestamp();
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.matching_candidate_before_update() FROM PUBLIC;
DROP TRIGGER IF EXISTS matching_candidate_before_update
  ON public.t_matching_candidate;
CREATE TRIGGER matching_candidate_before_update
  BEFORE UPDATE ON public.t_matching_candidate
  FOR EACH ROW
  EXECUTE FUNCTION public.matching_candidate_before_update();

CREATE POLICY "団体は応募ステータスを更新可能"
  ON public.t_matching_candidate FOR UPDATE
  USING (
    opportunity_id IN (
      SELECT o.id FROM public.m_opportunity o
      JOIN public.m_organization_profile org ON o.organization_id = org.id
      WHERE org.user_id = auth.uid()
    )
  )
  WITH CHECK (
    opportunity_id IN (
      SELECT o.id FROM public.m_opportunity o
      JOIN public.m_organization_profile org ON o.organization_id = org.id
      WHERE org.user_id = auth.uid()
    )
  );

-- t_participation_feedback: 当事者（応募した参加者・対象案件の団体）のみ閲覧可能
ALTER TABLE public.t_participation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "当事者は参加評価を閲覧可能"
  ON public.t_participation_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.t_matching_candidate mc
      LEFT JOIN public.m_opportunity o ON o.id = mc.opportunity_id
      LEFT JOIN public.m_organization_profile org ON org.id = o.organization_id
      WHERE mc.id = application_id
        AND (mc.participant_id = auth.uid() OR org.user_id = auth.uid())
    )
  );

-- ============================================
-- PostgREST ロール権限（ローカル開発用）
-- ============================================
-- RLS は行単位の認可であり、PostgreSQL のテーブル権限を付与しないと
-- anon / authenticated ロールから REST API を利用できない。
-- 付与対象はアプリが Supabase クライアント経由で参照・更新するテーブルに限定する。
GRANT USAGE ON SCHEMA public TO anon, authenticated;

REVOKE ALL ON TABLE public.m_user FROM anon, authenticated;
REVOKE ALL ON TABLE public.t_diagnosis_result FROM anon, authenticated;
REVOKE ALL ON TABLE public.t_diagnosis_response FROM anon, authenticated;
GRANT SELECT (id, is_active, role, suspended_at) ON public.m_user TO authenticated;
GRANT SELECT ON public.m_participant_profile TO authenticated;
GRANT SELECT ON public.t_diagnosis_result TO authenticated;

GRANT SELECT ON public.m_organization_profile TO anon, authenticated;
GRANT SELECT ON public.m_opportunity TO anon;
GRANT SELECT, INSERT, UPDATE ON public.m_opportunity TO authenticated;
GRANT SELECT ON public.t_recommendation_log TO authenticated;
GRANT SELECT, INSERT ON public.t_matching_candidate TO authenticated;
REVOKE UPDATE ON public.t_matching_candidate FROM authenticated;
GRANT UPDATE (status, status_changed_at, updated_at)
  ON public.t_matching_candidate TO authenticated;

-- ============================================
-- テストデータ（ローカル開発専用）
-- ============================================
-- 固定 UUID を使用してリレーションの整合性を確保する。
-- auth.users → トリガーで m_user が自動作成される。
-- パスワードは全て "password123" (bcrypt)

-- テスト用 UUID 定数
-- 参加者1: 11111111-1111-1111-1111-111111111111 (田中太郎)
-- 参加者2: 22222222-2222-2222-2222-222222222222 (佐藤花子)
-- 参加者3: 33333333-3333-3333-3333-333333333333 (鈴木一郎)
-- 団体1:   44444444-4444-4444-4444-444444444444 (NPO法人グリーンアース)
-- 団体2:   55555555-5555-5555-5555-555555555555 (NPO法人みらい学舎)

-- --------------------------------------------
-- 1. auth.users にテストユーザーを作成
-- --------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  -- 参加者1: 田中太郎
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'tanaka@example.com',
    '$2a$10$PznUGGGGnJXJOEp0E6x0xOhtES5fCIaJPO5ySuQYCPEGHE40hPmMG',
    NOW(), NOW(), NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "田中太郎", "role": "participant", "onboarding_completed": true}',
    '', '', '', ''
  ),
  -- 参加者2: 佐藤花子
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'sato@example.com',
    '$2a$10$PznUGGGGnJXJOEp0E6x0xOhtES5fCIaJPO5ySuQYCPEGHE40hPmMG',
    NOW(), NOW(), NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "佐藤花子", "role": "participant", "onboarding_completed": true}',
    '', '', '', ''
  ),
  -- 参加者3: 鈴木一郎
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated', 'authenticated',
    'suzuki@example.com',
    '$2a$10$PznUGGGGnJXJOEp0E6x0xOhtES5fCIaJPO5ySuQYCPEGHE40hPmMG',
    NOW(), NOW(), NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "鈴木一郎", "role": "participant", "onboarding_completed": true}',
    '', '', '', ''
  ),
  -- 団体1: NPO法人グリーンアース
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-4444-444444444444',
    'authenticated', 'authenticated',
    'greenearth@example.com',
    '$2a$10$PznUGGGGnJXJOEp0E6x0xOhtES5fCIaJPO5ySuQYCPEGHE40hPmMG',
    NOW(), NOW(), NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "NPO法人グリーンアース", "role": "organization", "onboarding_completed": true}',
    '', '', '', ''
  ),
  -- 団体2: NPO法人みらい学舎
  (
    '00000000-0000-0000-0000-000000000000',
    '55555555-5555-5555-5555-555555555555',
    'authenticated', 'authenticated',
    'mirai@example.com',
    '$2a$10$PznUGGGGnJXJOEp0E6x0xOhtES5fCIaJPO5ySuQYCPEGHE40hPmMG',
    NOW(), NOW(), NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "NPO法人みらい学舎", "role": "organization", "onboarding_completed": true}',
    '', '', '', ''
  );

-- auth.identities にメール認証情報を追加（ログイン可能にする）
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'tanaka@example.com', '{"sub": "11111111-1111-1111-1111-111111111111", "email": "tanaka@example.com"}', 'email', NOW(), NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'sato@example.com', '{"sub": "22222222-2222-2222-2222-222222222222", "email": "sato@example.com"}', 'email', NOW(), NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'suzuki@example.com', '{"sub": "33333333-3333-3333-3333-333333333333", "email": "suzuki@example.com"}', 'email', NOW(), NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 'greenearth@example.com', '{"sub": "44444444-4444-4444-4444-444444444444", "email": "greenearth@example.com"}', 'email', NOW(), NOW(), NOW()),
  ('55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 'mirai@example.com', '{"sub": "55555555-5555-5555-5555-555555555555", "email": "mirai@example.com"}', 'email', NOW(), NOW(), NOW());

-- ※ auth.users INSERT → on_auth_user_created トリガーにより m_user が自動作成済み

-- --------------------------------------------
-- 2. m_user のロールを更新（団体ユーザー）
-- --------------------------------------------
UPDATE public.m_user SET role = 'organization' WHERE id IN (
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);

-- --------------------------------------------
-- 3. 参加者プロフィール（診断情報は t_diagnosis_result で管理）
-- --------------------------------------------
INSERT INTO public.m_participant_profile (
  id, user_id, name, birthday, gender, bio, region,
  interests, availability, preferred_location, public_profile, created_at, updated_at
) VALUES
  -- 田中太郎（診断済み・後続で latest_diagnosis_result_id を設定）
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '田中太郎', '1995-06-15', '男性',
    '環境問題に関心があり、地域のゴミ拾い活動に参加しています。将来はNPOを立ち上げたいと考えています。',
    '東京都',
    '["環境保全", "地域活性化", "子ども支援"]',
    '{"weekdays": ["土", "日"], "time": "午前"}',
    '渋谷区', true, NOW(), NOW()
  ),
  -- 佐藤花子（診断済み）
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    '佐藤花子', '1998-03-22', '女性',
    '介護福祉士として働いています。休日は高齢者施設でのボランティアに参加したいです。',
    '神奈川県',
    '["高齢者支援", "障がい者サポート", "傾聴"]',
    '{"weekdays": ["水", "土"], "time": "午後"}',
    '横浜市', true, NOW(), NOW()
  ),
  -- 鈴木一郎: 未診断の新規参加者
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '33333333-3333-3333-3333-333333333333',
    '鈴木一郎', '2000-11-08', '男性',
    'プログラミングが得意で、IT関連のボランティアに興味があります。',
    '大阪府',
    '["IT支援", "教育", "プログラミング"]',
    '{"weekdays": ["土"], "time": "終日"}',
    '大阪市', true, NOW(), NOW()
  );

-- --------------------------------------------
-- 4. 団体プロフィール
-- --------------------------------------------
INSERT INTO public.m_organization_profile (
  id, user_id, organization_name, representative_name, contact_email,
  activity_areas, description, activity_categories,
  website_url, review_status, verified, profile_completeness, created_at, updated_at
) VALUES
  -- NPO法人グリーンアース（環境保全団体）
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '44444444-4444-4444-4444-444444444444',
    'NPO法人グリーンアース',
    '山田次郎',
    'info@greenearth.example.com',
    '["渋谷区", "世田谷区", "目黒区"]',
    '都市部の環境保全活動を中心に、地域清掃・植樹・環境教育を行っているNPO法人です。年間を通じて様々なイベントを開催しています。',
    '["環境保全", "地域活性化", "教育"]',
    'https://greenearth.example.com',
    'approved', true, 85, NOW(), NOW()
  ),
  -- NPO法人みらい学舎（子ども支援団体）
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '55555555-5555-5555-5555-555555555555',
    'NPO法人みらい学舎',
    '木村美咲',
    'info@mirai.example.com',
    '["新宿区", "中野区", "杉並区"]',
    '子どもの学習支援と居場所づくりを行っているNPO法人です。放課後の学習教室や、長期休暇中のキャンプを運営しています。',
    '["子ども支援", "教育", "居場所づくり"]',
    'https://mirai.example.com',
    'approved', true, 90, NOW(), NOW()
  );

-- --------------------------------------------
-- 5. 募集案件（activity_style_tags は加点のみに使う活動スタイルタグ）
-- --------------------------------------------
INSERT INTO public.m_opportunity (
  id, organization_id, title, description,
  activity_style_tags, required_qualifications, min_age, max_age,
  location, start_date, end_date, capacity, current_applicants,
  category, participation_mode,
  status, published_at, created_at, updated_at
) VALUES
  -- グリーンアースの案件
  (
    'f1111111-1111-1111-1111-111111111111',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '渋谷川クリーンアップ大作戦',
    '渋谷川沿いのゴミ拾いと自然環境の調査を行います。初心者大歓迎！道具は全てこちらで用意します。活動後はみんなでお茶を飲みながら交流会を行います。',
    '["talk-with-new-people", "routine-steady-work"]', NULL, NULL, NULL,
    '東京都渋谷区・渋谷川沿い',
    NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days', 20, 2,
    '環境保全', 'offline',
    'published', NOW(), NOW(), NOW()
  ),
  (
    'f2222222-2222-2222-2222-222222222222',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '世田谷エコガーデン植樹ボランティア',
    '世田谷区の空き地を緑豊かなコミュニティガーデンに変えるプロジェクトです。土いじりが好きな方、環境に興味がある方を募集中。',
    '["routine-steady-work", "empathy-support"]', NULL, NULL, NULL,
    '東京都世田谷区・経堂エリア',
    NOW() + INTERVAL '21 days', NOW() + INTERVAL '21 days', 15, 0,
    '環境保全', 'offline',
    'published', NOW(), NOW(), NOW()
  ),
  (
    'f3333333-3333-3333-3333-333333333333',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '環境データ入力・レポート作成ボランティア',
    '過去1年間の活動データの整理とレポート作成を手伝ってくださる方を募集します。Excel操作が得意な方歓迎。在宅で作業可能です。',
    '["solo-focused-work", "precise-scheduled-work"]', NULL, NULL, NULL,
    'オンライン（在宅可）',
    NOW() + INTERVAL '1 day', NOW() + INTERVAL '30 days', 3, 1,
    '環境保全', 'online',
    'published', NOW(), NOW(), NOW()
  ),
  -- みらい学舎の案件
  (
    'f4444444-4444-4444-4444-444444444444',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '小学生向け放課後学習サポーター',
    '小学生の宿題を一緒に見たり、遊びを通じた学びのサポートをお願いします。子どもが好きで、忍耐力のある方を探しています。',
    '["empathy-support", "precise-scheduled-work"]', NULL, NULL, NULL,
    '東京都新宿区・四谷教室',
    NOW() + INTERVAL '3 days', NOW() + INTERVAL '90 days', 10, 3,
    '子ども支援', 'offline',
    'published', NOW(), NOW(), NOW()
  ),
  (
    'f5555555-5555-5555-5555-555555555555',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '夏休みキャンプ引率ボランティア',
    '小中学生を対象とした3泊4日の自然体験キャンプの引率をお願いします。アウトドア経験者・体力に自信のある方歓迎！18歳以上の方が対象です。',
    '["talk-with-new-people", "calm-under-change"]', '["救急救命講習の受講経験（歓迎）"]', 18, NULL,
    '長野県・白馬村',
    NOW() + INTERVAL '30 days', NOW() + INTERVAL '33 days', 8, 0,
    '子ども支援', 'offline',
    'published', NOW(), NOW(), NOW()
  ),
  (
    'f6666666-6666-6666-6666-666666666666',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'ITスキル教室サポーター（中高生向け）',
    '中高生にプログラミングやデザインの基礎を教える教室のサポートスタッフを募集。IT系のスキルがある方、教えることが好きな方歓迎。',
    '["creative-ideas", "talk-with-new-people"]', NULL, NULL, NULL,
    '東京都中野区・みらい学舎本部',
    NOW() + INTERVAL '7 days', NOW() + INTERVAL '60 days', 5, 1,
    '教育', 'hybrid',
    'published', NOW(), NOW(), NOW()
  ),
  -- 下書き案件（非公開）
  (
    'f7777777-7777-7777-7777-777777777777',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '秋の大規模環境フェスティバル（企画中）',
    '10月に開催予定の大規模イベント。詳細は調整中です。',
    NULL, NULL, NULL, NULL,
    '東京都渋谷区・代々木公園',
    NOW() + INTERVAL '100 days', NOW() + INTERVAL '100 days', 50, 0,
    '環境保全', 'offline',
    'draft', NULL, NOW(), NOW()
  );

-- --------------------------------------------
-- 6. 診断結果（IPIP-BFM-50 日本語版・各バージョンを保存）
-- --------------------------------------------
-- 田中太郎の診断結果（innovator-leader に近い傾向）
INSERT INTO public.t_diagnosis_result (
  id, user_id,
  scale_code, scale_version, scoring_algorithm_version, norms_version,
  style_type_version, quality_rule_version,
  raw_scores, scaled_scores, style_type_id, quality_flags,
  total_duration_ms, resumed_count, answered_at, created_at
) VALUES
  (
    'aaa11111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'ipip-bfm-50-ja', '1.0.0', '1.0.0', NULL,
    '1.0.0', '1.0.0',
    '{"extraversion": 43, "agreeableness": 36, "conscientiousness": 41, "emotionalStability": 38, "intellect": 45}',
    '{"extraversion": 82.5, "agreeableness": 65.0, "conscientiousness": 77.5, "emotionalStability": 70.0, "intellect": 87.5}',
    'innovator-leader', '[]',
    360000, 0, NOW(), NOW()
  );

-- 佐藤花子の診断結果（supporter-care に近い傾向）
INSERT INTO public.t_diagnosis_result (
  id, user_id,
  scale_code, scale_version, scoring_algorithm_version, norms_version,
  style_type_version, quality_rule_version,
  raw_scores, scaled_scores, style_type_id, quality_flags,
  total_duration_ms, resumed_count, answered_at, created_at
) VALUES
  (
    'bbb22222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    'ipip-bfm-50-ja', '1.0.0', '1.0.0', NULL,
    '1.0.0', '1.0.0',
    '{"extraversion": 37, "agreeableness": 46, "conscientiousness": 39, "emotionalStability": 40, "intellect": 34}',
    '{"extraversion": 67.5, "agreeableness": 90.0, "conscientiousness": 72.5, "emotionalStability": 75.0, "intellect": 60.0}',
    'supporter-care', '[]',
    420000, 1, NOW(), NOW()
  );

-- 最新診断結果への参照を設定
UPDATE public.m_participant_profile
SET latest_diagnosis_result_id = 'aaa11111-1111-1111-1111-111111111111'
WHERE user_id = '11111111-1111-1111-1111-111111111111';

UPDATE public.m_participant_profile
SET latest_diagnosis_result_id = 'bbb22222-2222-2222-2222-222222222222'
WHERE user_id = '22222222-2222-2222-2222-222222222222';

-- --------------------------------------------
-- 7. 応募（マッチング候補）
-- --------------------------------------------
INSERT INTO public.t_matching_candidate (
  id, participant_id, opportunity_id,
  status, message,
  applied_at, status_changed_at, created_at, updated_at
) VALUES
  -- 田中太郎 → 渋谷川クリーンアップ（応募済み）
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'f1111111-1111-1111-1111-111111111111',
    'applied',
    '環境問題に関心があり、ぜひ参加させてください！',
    NOW(), NOW(), NOW(), NOW()
  ),
  -- 佐藤花子 → 放課後学習サポーター（承認済み）
  (
    gen_random_uuid(),
    '22222222-2222-2222-2222-222222222222',
    'f4444444-4444-4444-4444-444444444444',
    'accepted',
    '子どもの学習支援に興味があります。介護福祉士の経験を活かしたいです。',
    NOW(), NOW(), NOW(), NOW()
  );

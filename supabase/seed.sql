-- ============================================
-- Supabase ローカル開発用シードSQL
-- ============================================
-- supabase db reset 実行時に Prisma マイグレーション後に自動適用される。
-- Auth トリガー・RLS ポリシーをローカル環境にも反映する。
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
    '{"full_name": "田中太郎"}',
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
    '{"full_name": "佐藤花子"}',
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
    '{"full_name": "鈴木一郎"}',
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
    '{"full_name": "NPO法人グリーンアース"}',
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
    '{"full_name": "NPO法人みらい学舎"}',
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
-- 3. 参加者プロフィール
-- --------------------------------------------
INSERT INTO public.m_participant_profile (
  id, user_id, name, birthday, gender, bio, region,
  interests, diagnosis_type, diagnosis_scores,
  availability, preferred_location, public_profile, created_at, updated_at
) VALUES
  -- 田中太郎: イノベーター・リーダータイプ（診断済み）
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '田中太郎', '1995-06-15', '男性',
    '環境問題に関心があり、地域のゴミ拾い活動に参加しています。将来はNPOを立ち上げたいと考えています。',
    '東京都',
    '["環境保全", "地域活動", "子ども支援"]',
    'イノベーター・リーダータイプ',
    '{"extraversion": 82, "agreeableness": 65, "conscientiousness": 78, "neuroticism": 30, "openness": 88}',
    '{"weekdays": ["土", "日"], "time": "午前"}',
    '渋谷区', true, NOW(), NOW()
  ),
  -- 佐藤花子: サポーター・ケアタイプ（診断済み）
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    '佐藤花子', '1998-03-22', '女性',
    '介護福祉士として働いています。休日は高齢者施設でのボランティアに参加したいです。',
    '神奈川県',
    '["高齢者支援", "障がい者サポート", "傾聴"]',
    'サポーター・ケアタイプ',
    '{"extraversion": 68, "agreeableness": 90, "conscientiousness": 72, "neuroticism": 25, "openness": 60}',
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
    NULL, NULL,
    '{"weekdays": ["土"], "time": "終日"}',
    '大阪市', true, NOW(), NOW()
  );

-- --------------------------------------------
-- 4. 団体プロフィール
-- --------------------------------------------
INSERT INTO public.m_organization_profile (
  id, user_id, organization_name, representative_name, contact_email,
  activity_areas, description, activity_categories,
  website_url, verified, profile_completeness, created_at, updated_at
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
    '["環境保全", "地域活動", "教育"]',
    'https://greenearth.example.com',
    true, 85, NOW(), NOW()
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
    true, 90, NOW(), NOW()
  );

-- --------------------------------------------
-- 5. 人物タイプマスタ（10類型）
-- --------------------------------------------
INSERT INTO public.m_personality_type (
  id, type_id, name_ja, name_en, description,
  criteria, priority, strengths, suitable_activities, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'innovator-leader', 'イノベーター・リーダータイプ', 'Innovator Leader',
   '新しいアイデアを積極的に提案し、チームを牽引する',
   '{"extraversion": {"min": 75}, "openness": {"min": 80}, "conscientiousness": {"min": 70}}',
   1, '["プロジェクトリーダー", "企画立案", "新規事業開発"]', '["イベント統括", "社会課題の新規アプローチ開発"]', NOW(), NOW()),

  (gen_random_uuid(), 'supporter-care', 'サポーター・ケアタイプ', 'Supporter Care',
   '他人の感情に敏感で、献身的にサポート',
   '{"agreeableness": {"min": 80}, "extraversion": {"min": 60}, "neuroticism": {"max": 40}}',
   2, '["高齢者支援", "障がい者サポート", "傾聴ボランティア"]', '["個別相談", "継続的な見守り活動"]', NOW(), NOW()),

  (gen_random_uuid(), 'creative-solo', 'クリエイティブ・ソロタイプ', 'Creative Solo',
   '独創的なアイデアを一人で深く追求',
   '{"openness": {"min": 95}, "extraversion": {"max": 20}, "conscientiousness": {"min": 60}}',
   3, '["デザイン制作", "ライティング", "動画編集"]', '["広報物作成", "アート制作", "静かな環境での作業"]', NOW(), NOW()),

  (gen_random_uuid(), 'perfectionist-analyst', 'パーフェクショニスト・アナリストタイプ', 'Perfectionist Analyst',
   '細部まで完璧を追求し、高い品質基準を持つ',
   '{"conscientiousness": {"min": 95}, "neuroticism": {"min": 70}, "openness": {"min": 50}}',
   4, '["データ入力", "会計管理", "記録作成"]', '["精密な作業", "品質チェック", "ドキュメント整備"]', NOW(), NOW()),

  (gen_random_uuid(), 'charisma-entertainer', 'カリスマ・エンターテイナータイプ', 'Charisma Entertainer',
   '人を惹きつけ、楽しい雰囲気を作り出す',
   '{"extraversion": {"min": 95}, "agreeableness": {"min": 80}, "openness": {"min": 85}}',
   5, '["子どもイベント", "募金活動", "PR活動"]', '["ステージ進行", "来場者対応", "SNS発信"]', NOW(), NOW()),

  (gen_random_uuid(), 'strategist-planner', 'ストラテジスト・プランナータイプ', 'Strategist Planner',
   '長期的視点で戦略を立て、確実に実行',
   '{"conscientiousness": {"min": 90}, "openness": {"min": 75}, "neuroticism": {"max": 40}}',
   6, '["プロジェクトマネジメント", "予算管理", "進捗管理"]', '["企画全体の設計", "リスク管理", "成果測定"]', NOW(), NOW()),

  (gen_random_uuid(), 'harmony-mediator', 'ハーモニー・メディエータータイプ', 'Harmony Mediator',
   '対立を避け、チーム内の調和を重視',
   '{"agreeableness": {"min": 95}, "neuroticism": {"max": 35}, "extraversion": {"min": 60}}',
   7, '["チーム調整", "意見とりまとめ", "紛争解決"]', '["ファシリテーション", "多様な参加者の橋渡し"]', NOW(), NOW()),

  (gen_random_uuid(), 'adventure-explorer', 'アドベンチャー・エクスプローラータイプ', 'Adventure Explorer',
   '新しい経験や冒険を求め、リスクを恐れない',
   '{"openness": {"min": 90}, "extraversion": {"min": 85}, "neuroticism": {"max": 25}}',
   8, '["屋外活動", "被災地支援", "海外ボランティア"]', '["身体を使う活動", "未知の環境への対応"]', NOW(), NOW()),

  (gen_random_uuid(), 'conservative-guardian', 'コンサバティブ・ガーディアンタイプ', 'Conservative Guardian',
   '伝統や規則を重視し、安定を求める',
   '{"conscientiousness": {"min": 85}, "agreeableness": {"min": 75}, "openness": {"max": 30}}',
   9, '["定例活動", "ルール遵守", "安全管理"]', '["継続的な地域清掃", "伝統行事の運営補助"]', NOW(), NOW()),

  (gen_random_uuid(), 'sensitive-artist', 'センシティブ・アーティストタイプ', 'Sensitive Artist',
   '感受性が豊かで、繊細な表現を得意とする',
   '{"openness": {"min": 90}, "neuroticism": {"min": 75}, "extraversion": {"max": 35}}',
   10, '["音楽演奏", "詩の朗読", "アート療法"]', '["少人数の穏やかな環境での創作活動"]', NOW(), NOW());

-- --------------------------------------------
-- 6. 募集案件
-- --------------------------------------------
INSERT INTO public.m_opportunity (
  id, organization_id, title, description,
  requirement_traits, location,
  start_date, end_date, capacity, current_applicants,
  status, published_at, created_at, updated_at
) VALUES
  -- グリーンアースの案件
  (
    'f1111111-1111-1111-1111-111111111111',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '渋谷川クリーンアップ大作戦',
    '渋谷川沿いのゴミ拾いと自然環境の調査を行います。初心者大歓迎！道具は全てこちらで用意します。活動後はみんなでお茶を飲みながら交流会を行います。',
    '{"extraversion": {"min": 50}, "conscientiousness": {"min": 60}}',
    '渋谷区・渋谷川沿い',
    '2026-05-10', '2026-05-10', 20, 2,
    'published', NOW(), NOW(), NOW()
  ),
  (
    'f2222222-2222-2222-2222-222222222222',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '世田谷エコガーデン植樹ボランティア',
    '世田谷区の空き地を緑豊かなコミュニティガーデンに変えるプロジェクトです。土いじりが好きな方、環境に興味がある方を募集中。',
    '{"openness": {"min": 60}, "agreeableness": {"min": 50}}',
    '世田谷区・経堂エリア',
    '2026-05-17', '2026-05-17', 15, 0,
    'published', NOW(), NOW(), NOW()
  ),
  (
    'f3333333-3333-3333-3333-333333333333',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '環境データ入力・レポート作成ボランティア',
    '過去1年間の活動データの整理とレポート作成を手伝ってくださる方を募集します。Excel操作が得意な方歓迎。在宅で作業可能です。',
    '{"conscientiousness": {"min": 80}, "openness": {"min": 50}}',
    'オンライン（在宅可）',
    '2026-05-01', '2026-05-31', 3, 1,
    'published', NOW(), NOW(), NOW()
  ),
  -- みらい学舎の案件
  (
    'f4444444-4444-4444-4444-444444444444',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '小学生向け放課後学習サポーター',
    '小学生の宿題を一緒に見たり、遊びを通じた学びのサポートをお願いします。子どもが好きで、忍耐力のある方を探しています。',
    '{"agreeableness": {"min": 70}, "extraversion": {"min": 50}, "neuroticism": {"max": 50}}',
    '新宿区・四谷教室',
    '2026-05-07', '2026-07-31', 10, 3,
    'published', NOW(), NOW(), NOW()
  ),
  (
    'f5555555-5555-5555-5555-555555555555',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '夏休みキャンプ引率ボランティア',
    '小中学生を対象とした3泊4日の自然体験キャンプの引率をお願いします。アウトドア経験者・体力に自信のある方歓迎！',
    '{"extraversion": {"min": 70}, "openness": {"min": 60}, "neuroticism": {"max": 40}}',
    '長野県・白馬村',
    '2026-07-25', '2026-07-28', 8, 0,
    'published', NOW(), NOW(), NOW()
  ),
  (
    'f6666666-6666-6666-6666-666666666666',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'ITスキル教室サポーター（中高生向け）',
    '中高生にプログラミングやデザインの基礎を教える教室のサポートスタッフを募集。IT系のスキルがある方、教えることが好きな方歓迎。',
    '{"openness": {"min": 70}, "conscientiousness": {"min": 60}}',
    '中野区・みらい学舎本部',
    '2026-06-01', '2026-08-31', 5, 1,
    'published', NOW(), NOW(), NOW()
  ),
  -- 下書き案件（非公開）
  (
    'f7777777-7777-7777-7777-777777777777',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '秋の大規模環境フェスティバル（企画中）',
    '10月に開催予定の大規模イベント。詳細は調整中です。',
    NULL,
    '渋谷区・代々木公園',
    '2026-10-15', '2026-10-15', 50, 0,
    'draft', NULL, NOW(), NOW()
  );

-- --------------------------------------------
-- 7. 診断結果
-- --------------------------------------------
-- 田中太郎の診断結果（イノベーター・リーダータイプ）
INSERT INTO public.t_diagnosis_result (
  id, user_id, personality_type_id,
  big5_scores, closest_type_distance,
  concluded_at, created_at, updated_at
) VALUES
  (
    'aaa11111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.m_personality_type WHERE type_id = 'innovator-leader'),
    '{"extraversion": 82, "agreeableness": 65, "conscientiousness": 78, "neuroticism": 30, "openness": 88}',
    0,
    NOW(), NOW(), NOW()
  );

-- 佐藤花子の診断結果（サポーター・ケアタイプ）
INSERT INTO public.t_diagnosis_result (
  id, user_id, personality_type_id,
  big5_scores, closest_type_distance,
  concluded_at, created_at, updated_at
) VALUES
  (
    'bbb22222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    (SELECT id FROM public.m_personality_type WHERE type_id = 'supporter-care'),
    '{"extraversion": 68, "agreeableness": 90, "conscientiousness": 72, "neuroticism": 25, "openness": 60}',
    0,
    NOW(), NOW(), NOW()
  );

-- --------------------------------------------
-- 8. マッチング候補（レコメンド + 応募）
-- --------------------------------------------
INSERT INTO public.t_matching_candidate (
  id, participant_id, opportunity_id, diagnosis_result_id,
  match_score, score_breakdown,
  status, method, message,
  applied_at, status_changed_at, created_at, updated_at
) VALUES
  -- 田中太郎 → 渋谷川クリーンアップ（応募済み）
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'f1111111-1111-1111-1111-111111111111',
    'aaa11111-1111-1111-1111-111111111111',
    85.5,
    '{"ruleBasedScore": 85.5, "traitMatch": {"extraversion": 90, "conscientiousness": 81}}',
    'applied', 'rule-based',
    '環境問題に関心があり、ぜひ参加させてください！',
    NOW(), NOW(), NOW(), NOW()
  ),
  -- 田中太郎 → ITスキル教室（レコメンド）
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'f6666666-6666-6666-6666-666666666666',
    'aaa11111-1111-1111-1111-111111111111',
    72.0,
    '{"ruleBasedScore": 72.0, "traitMatch": {"openness": 88, "conscientiousness": 78}}',
    'queued', 'rule-based',
    NULL,
    NULL, NOW(), NOW(), NOW()
  ),
  -- 佐藤花子 → 放課後学習サポーター（承認済み）
  (
    gen_random_uuid(),
    '22222222-2222-2222-2222-222222222222',
    'f4444444-4444-4444-4444-444444444444',
    'bbb22222-2222-2222-2222-222222222222',
    92.0,
    '{"ruleBasedScore": 92.0, "traitMatch": {"agreeableness": 95, "extraversion": 75, "neuroticism": 90}}',
    'accepted', 'rule-based',
    '子どもの学習支援に興味があります。介護福祉士の経験を活かしたいです。',
    NOW(), NOW(), NOW(), NOW()
  ),
  -- 佐藤花子 → 渋谷川クリーンアップ（レコメンド）
  (
    gen_random_uuid(),
    '22222222-2222-2222-2222-222222222222',
    'f1111111-1111-1111-1111-111111111111',
    'bbb22222-2222-2222-2222-222222222222',
    68.0,
    '{"ruleBasedScore": 68.0, "traitMatch": {"extraversion": 72, "conscientiousness": 64}}',
    'queued', 'rule-based',
    NULL,
    NULL, NOW(), NOW(), NOW()
  );

-- Supabase RLS ポリシー（防御層）
--
-- アプリケーションは Prisma の直接続（RLS対象外のDBロール）で動作し、
-- 認可は Server Actions 内のチェックで担保している。
-- 本ポリシーは anon / authenticated ロール経由の直接アクセスに対する防御層であり、
-- Supabase 環境でのみ適用する（ローカル docker Postgres には auth スキーマがないため適用不可）。
--
-- 適用方法: Supabase SQL Editor または `supabase db execute --file` で実行する。
-- 参照: docs/design/personality-matching-redesign.md §8.4

-- 診断結果: 本人のみ read。書き込みは Server Actions（サービスロール）経由のみ
ALTER TABLE t_diagnosis_result ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS diagnosis_result_select_own ON t_diagnosis_result;
CREATE POLICY diagnosis_result_select_own ON t_diagnosis_result
  FOR SELECT USING (auth.uid() = user_id);

-- 診断の生回答: 本人のみ read（診断結果経由）
ALTER TABLE t_diagnosis_response ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS diagnosis_response_select_own ON t_diagnosis_response;
CREATE POLICY diagnosis_response_select_own ON t_diagnosis_response
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM t_diagnosis_result r
      WHERE r.id = diagnosis_result_id AND r.user_id = auth.uid()
    )
  );

-- 推薦ログ: 本人のみ read
ALTER TABLE t_recommendation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recommendation_log_select_own ON t_recommendation_log;
CREATE POLICY recommendation_log_select_own ON t_recommendation_log
  FOR SELECT USING (auth.uid() = user_id);

-- エンゲージメントイベント: 本人のみ read
ALTER TABLE t_engagement_event ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS engagement_event_select_own ON t_engagement_event;
CREATE POLICY engagement_event_select_own ON t_engagement_event
  FOR SELECT USING (auth.uid() = user_id);

-- 参加評価: 当事者（応募した参加者・対象案件の団体）のみ read
ALTER TABLE t_participation_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS participation_feedback_select_parties ON t_participation_feedback;
CREATE POLICY participation_feedback_select_parties ON t_participation_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM t_matching_candidate mc
      LEFT JOIN m_opportunity o ON o.id = mc.opportunity_id
      LEFT JOIN m_organization_profile org ON org.id = o.organization_id
      WHERE mc.id = application_id
        AND (mc.participant_id = auth.uid() OR org.user_id = auth.uid())
    )
  );

/**
 * 団体ダッシュボード関連の型定義
 *
 * Super MVP 設計書 セクション3 のスキーマに基づく。
 * - opportunities: 自団体の募集案件
 * - applications: 各案件の応募者数（COUNT）
 */

/** 募集案件ステータス（DBスキーマ: draft / published / closed） */
export type OpportunityStatus = "draft" | "published" | "closed";

/** 自団体の募集案件（応募者数付き） */
export interface DashboardOpportunity {
  id: string;
  title: string;
  status: OpportunityStatus;
  created_at: string;
  application_count: number;
}

/** fetchMyOpportunities の戻り値 */
export interface DashboardData {
  opportunities: DashboardOpportunity[];
}

/** createOpportunity の戻り値 */
export interface CreateOpportunityResult {
  success: boolean;
  error?: string;
}

/** 編集用の案件データ（フォームプリフィル用） */
export interface OpportunityEditData {
  id: string;
  title: string;
  description: string;
  required_traits: Record<string, number> | null;
  status: OpportunityStatus;
}

/** fetchOpportunityForEdit の戻り値 */
export interface OpportunityEditResult {
  opportunity: OpportunityEditData | null;
  error?: string;
}

/** updateOpportunity の戻り値 */
export interface UpdateOpportunityResult {
  success: boolean;
  error?: string;
}

/** 応募ステータス */
export type ApplicationStatus = "pending" | "approved" | "rejected";

/** 応募者情報（applications + participants JOIN 結果） */
export interface Applicant {
  /** 応募ID */
  id: string;
  /** 応募ステータス */
  status: ApplicationStatus;
  /** 応募メッセージ */
  message: string | null;
  /** 応募日 */
  created_at: string;
  /** 参加者名 */
  participant_name: string;
  /** 診断タイプ（10類型名） */
  diagnosis_type: string | null;
  /** BIG5 スコア（JSONB） */
  diagnosis_scores: Record<string, number> | null;
  /** マッチングスコア (0-100) */
  match_score: number | null;
}

/** 案件詳細 + 応募者一覧（団体ダッシュボード用） */
export interface OpportunityWithApplicants {
  /** 案件ID */
  id: string;
  /** 案件タイトル */
  title: string;
  /** 案件説明 */
  description: string | null;
  /** 案件ステータス */
  status: OpportunityStatus;
  /** 求める性格特性 */
  required_traits: Record<string, number> | null;
  /** 作成日 */
  created_at: string;
  /** 応募者一覧 */
  applicants: Applicant[];
}

/** fetchApplicantsForOpportunity の戻り値 */
export interface ApplicantsResult {
  /** 案件 + 応募者データ（自団体の案件でない場合は null） */
  data: OpportunityWithApplicants | null;
  /** エラーメッセージ */
  error?: string;
}

/** updateApplicationStatus の戻り値 */
export interface UpdateApplicationStatusResult {
  success: boolean;
  error?: string;
}

/** 応募者詳細情報（applications + participants + personalityType JOIN） */
export interface ApplicantDetail {
  /** 応募ID */
  id: string;
  /** 応募ステータス */
  status: ApplicationStatus;
  /** 応募メッセージ */
  message: string | null;
  /** 応募日 */
  created_at: string;
  /** 参加者名 */
  participant_name: string;
  /** 診断タイプ名（10類型名） */
  diagnosis_type: string | null;
  /** BIG5 スコア（JSONB） */
  diagnosis_scores: Record<string, number> | null;
  /** マッチングスコア (0-100) */
  match_score: number | null;
  /** 案件ID */
  opportunity_id: string;
  /** 案件タイトル */
  opportunity_title: string;
  /** 人物タイプ詳細（PERSONALITY_TYPES から引き当て） */
  personality_type_detail: {
    name: string;
    nameEn: string;
    description: string;
    strengths: string[];
    suitableActivities: string[];
  } | null;
}

/** fetchApplicantDetail の戻り値 */
export interface ApplicantDetailResult {
  /** 応募者詳細データ（見つからない場合は null） */
  data: ApplicantDetail | null;
  /** エラーメッセージ */
  error?: string;
}

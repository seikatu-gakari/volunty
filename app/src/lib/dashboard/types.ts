/**
 * 団体ダッシュボード関連の型定義
 *
 * Super MVP 設計書 セクション3 のスキーマに基づく。
 * - opportunities: 自団体の募集案件
 * - applications: 各案件の応募者数（COUNT）
 */

import type { RecommendedParticipant } from "./recommended-participants";
import type { ParticipationMode } from "@/lib/opportunities/constants";

/** 募集案件ステータス（DBスキーマ: draft / published / closed） */
export type OpportunityStatus = "draft" | "published" | "closed";

export type { ParticipationMode };

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
  /** 活動場所 */
  location: string | null;
  /** 開始日（YYYY-MM-DD） */
  start_date: string | null;
  /** 終了日（YYYY-MM-DD） */
  end_date: string | null;
  /** 定員 */
  capacity: number | null;
  /** カテゴリ */
  category: string | null;
  /** 参加形態 */
  participation_mode: ParticipationMode | null;
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
export type ApplicationStatus = "pending" | "approved" | "rejected" | "completed";

/** マッチング履歴に表示する応募ステータス */
export type MatchingHistoryStatus = Extract<
  ApplicationStatus,
  "approved" | "rejected"
>;

/** 団体向けマッチング履歴の1件 */
export interface MatchingHistoryItem {
  /** 応募ID */
  id: string;
  /** 履歴表示用ステータス */
  status: MatchingHistoryStatus;
  /** 応募者名 */
  participant_name: string;
  /** 案件ID */
  opportunity_id: string;
  /** 案件タイトル */
  opportunity_title: string;
  /** 応募日時 */
  applied_at: string | null;
  /** 承認・辞退の処理日時 */
  status_changed_at: string;
  /** マッチングスコア (0-100) */
  match_score: number | null;
}

/** fetchMatchingHistory の戻り値 */
export interface MatchingHistoryResult {
  /** 自団体の承認・辞退済み応募履歴 */
  history: MatchingHistoryItem[];
  /** エラーメッセージ */
  error?: string;
}

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
  /** 活動完了日 */
  completed_at: string | null;
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
  /** 活動完了日 */
  completed_at: string | null;
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

/** おすすめ参加者一覧の空状態理由 */
export type RecommendedParticipantsEmptyReason =
  | "no_published_opportunities"
  | "no_recommended_participants";

/** fetchRecommendedParticipants の戻り値 */
export interface RecommendedParticipantsResult {
  /** 相性スコア順の参加者候補 */
  participants: RecommendedParticipant[];
  /** 表示すべき空状態の理由 */
  emptyReason?: RecommendedParticipantsEmptyReason;
  /** エラーメッセージ */
  error?: string;
}

/** fetchRecommendedParticipantDetail の戻り値 */
export interface RecommendedParticipantDetailResult {
  /** 参加者詳細データ（見つからない場合は null） */
  participant: RecommendedParticipant | null;
  /** 表示すべき空状態の理由 */
  emptyReason?: RecommendedParticipantsEmptyReason;
  /** エラーメッセージ */
  error?: string;
}

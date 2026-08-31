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

/** 応募者一覧の並び替え条件 */
export type ApplicantSort = "compatibility" | "applied_desc" | "applied_asc";

/** 応募者一覧のステータス絞り込み */
export type ApplicantStatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "completed";

export interface ApplicantListOptions {
  sort?: ApplicantSort;
  status?: ApplicantStatusFilter;
}

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
  /** 活動スタイルタグID（最大3） */
  activity_style_tags: string[];
  /** 必須資格 */
  required_qualifications: string[];
  /** 対象年齢の下限（法的・安全上必要な場合のみ） */
  min_age: number | null;
  /** 対象年齢の上限（法的・安全上必要な場合のみ） */
  max_age: number | null;
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
  "approved" | "rejected" | "completed"
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
  /** 承認・辞退・活動完了の処理日時 */
  status_changed_at: string;
}

/** fetchMatchingHistory の戻り値 */
export interface MatchingHistoryResult {
  /** 自団体の承認・辞退・活動完了済み応募履歴 */
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
  /** 活動スタイルの参考タイプ名（未診断は null。生スコアは開示しない） */
  style_type_label: string | null;
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

/** 活動完了報告の一括操作結果 */
export interface BulkCompleteApplicationsResult {
  success: boolean;
  completedCount: number;
  failedCount: number;
  error?: string;
}

/** 団体ダッシュボード分析: 案件ごとの指標 */
export interface OpportunityAnalytics {
  opportunityId: string;
  title: string;
  viewCount: number;
  applicationCount: number;
  approvedCount: number;
  approvalRate: number;
  declinedCount: number;
  completedCount: number;
}

/** 団体ダッシュボード分析: アプローチ指標 */
export interface ApproachAnalytics {
  sentTotal: number;
  acceptedCount: number;
  acceptanceRate: number;
  declinedCount: number;
  pendingCount: number;
}

export interface DashboardAnalyticsResult {
  opportunities: OpportunityAnalytics[];
  approaches: ApproachAnalytics;
  error?: string;
}

/** 応募者詳細情報（生の診断スコアは団体へ開示しない） */
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
  /** accepted の自団体応募に限り含まれる参加者LINE ID */
  participant_line_id?: string | null;
  /** 活動スタイルの参考タイプ名（未診断は null） */
  style_type_label: string | null;
  /** 案件ID */
  opportunity_id: string;
  /** 案件タイトル */
  opportunity_title: string;
  /** 参考タイプ詳細（補助的な説明情報） */
  style_type_detail: {
    name: string;
    nameEn: string;
    description: string;
    tendencies: string[];
    activityExamples: string[];
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
  /** 活動スタイル適合の参加者候補 */
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

/**
 * 募集案件詳細ページに関する型定義
 *
 * Super MVP 設計書 セクション3 のスキーマに基づく。
 * - opportunities: 募集案件
 * - organizations: 募集団体
 * - applications: 応募情報
 */

/** 案件ステータス */
export type OpportunityStatus = "open" | "closed";

/** 応募ステータス */
export type ApplicationStatus = "pending" | "approved" | "rejected";

/** 募集団体情報 */
export interface OrganizationInfo {
  id: string;
  name: string;
  description: string | null;
}

/** 募集案件の詳細情報 */
export interface OpportunityDetail {
  id: string;
  title: string;
  description: string | null;
  required_traits: Record<string, number> | null;
  status: OpportunityStatus;
  organization: OrganizationInfo;
  created_at: string;
}

/** 既存の応募情報 */
export interface ExistingApplication {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  created_at: string;
}

/** fetchOpportunityDetail の戻り値 */
export interface OpportunityDetailResult {
  /** 案件データ（存在しない場合は null） */
  opportunity: OpportunityDetail | null;
  /** マッチングスコア（参加者かつ診断済みの場合のみ、0-100） */
  matchScore: number | null;
  /** 既存の応募（応募済みの場合） */
  existingApplication: ExistingApplication | null;
  /** ログインユーザーが参加者であるか */
  isParticipant: boolean;
}

/** applyToOpportunity の戻り値 */
export interface ApplyResult {
  success: boolean;
  error?: string;
}

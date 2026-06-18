/**
 * 募集案件詳細ページに関する型定義
 *
 * Super MVP 設計書 セクション3 のスキーマに基づく。
 * - opportunities: 募集案件
 * - organizations: 募集団体
 * - applications: 応募情報
 */

import type { ParticipationMode } from "@/lib/opportunities/constants";

/** 案件ステータス（DBスキーマ: draft / published / closed） */
export type OpportunityStatus = "draft" | "published" | "closed";

/** 応募ステータス */
export type ApplicationStatus = "pending" | "approved" | "rejected" | "completed";

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
  /** 活動場所 */
  location: string | null;
  /** 開始日（YYYY-MM-DD） */
  start_date: string | null;
  /** 終了日（YYYY-MM-DD） */
  end_date: string | null;
  /** 定員 */
  capacity: number | null;
  /** 現在の応募者数 */
  current_applicants: number;
  /** カテゴリ */
  category: string | null;
  /** 参加形態 */
  participation_mode: ParticipationMode | null;
}

/** 既存の応募情報 */
export interface ExistingApplication {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  created_at: string;
  completed_at: string | null;
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

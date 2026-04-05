/**
 * 団体ダッシュボード関連の型定義
 *
 * Super MVP 設計書 セクション3 のスキーマに基づく。
 * - opportunities: 自団体の募集案件
 * - applications: 各案件の応募者数（COUNT）
 */

/** 募集案件ステータス */
export type OpportunityStatus = "open" | "closed";

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

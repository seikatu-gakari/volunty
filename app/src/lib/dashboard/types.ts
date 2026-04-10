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

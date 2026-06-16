/**
 * マイページ関連の型定義
 *
 * Super MVP 設計書 セクション3 のスキーマに基づく。
 * - participants: 参加者プロフィール
 * - applications + opportunities + organizations: 応募進捗・団体情報
 */

/** 応募ステータス */
export type ApplicationStatus = "pending" | "approved" | "rejected" | "completed";

/** 参加者プロフィール（participants テーブル） */
export interface ParticipantProfile {
  id: string;
  name: string;
  region: string;
  diagnosis_type: string | null;
  diagnosis_scores: Record<string, number> | null;
  /** 診断実施日時（ISO 8601 文字列）。未受診または取得不可の場合は null */
  diagnosis_updated_at: string | null;
}

/** 応募に紐づく募集案件情報（opportunities テーブル） */
export interface ApplicationOpportunity {
  id: string;
  title: string;
  organization_name: string;
  /** マッチング成立時のみ含まれる */
  organization_line_id: string | null;
}

/** 応募情報（applications テーブル + JOIN 結果） */
export interface ApplicationWithDetails {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  created_at: string;
  completed_at: string | null;
  can_request_certificate: boolean;
  opportunity: ApplicationOpportunity;
}

/** データ取得時の注意アラート */
export interface DataFetchAlert {
  title: string;
  message: string;
  detail: string;
}

/** fetchMyApplications の戻り値 */
export interface MyPageData {
  profile: ParticipantProfile | null;
  applications: ApplicationWithDetails[];
  alert: DataFetchAlert | null;
}

/** アカウント削除フォームの状態 */
export interface DeleteAccountState {
  error: string | null;
}

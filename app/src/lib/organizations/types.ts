/**
 * 団体詳細ページに関する型定義
 *
 * Super MVP 設計書 セクション3 のスキーマに基づく。
 * - organizations: 団体プロフィール
 * - opportunities: 募集案件
 */

/** 団体詳細情報 */
export interface OrganizationDetail {
  /** 団体ID */
  id: string;
  /** 団体名 */
  name: string;
  /** 活動内容 */
  description: string | null;
}

/** 団体が公開中の募集案件 */
export interface OrganizationOpportunity {
  /** 案件ID */
  id: string;
  /** 案件タイトル */
  title: string;
  /** 案件説明 */
  description: string | null;
}

/** fetchOrganizationDetail の戻り値 */
export interface OrganizationDetailResult {
  /** 団体データ（存在しない場合は null） */
  organization: OrganizationDetail | null;
  /** 公開中の募集案件一覧 */
  opportunities: OrganizationOpportunity[];
  /** ログインユーザーが参加者であるか */
  isParticipant: boolean;
}

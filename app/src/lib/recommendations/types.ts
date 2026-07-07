/**
 * おすすめ案件一覧に関する型定義
 */

export interface OpportunityRecommendation {
  /** 案件ID */
  id: string
  /** 案件タイトル */
  title: string
  /** 案件の簡易説明 */
  description: string | null
  /** 団体名 */
  organizationName: string
  /** 日本語の推薦理由（最大2件） */
  reasons: string[]
  /** この表示を記録した推薦ログID（応募時のトラッキングに使用） */
  recommendationLogId: string | null
}

export interface RecommendationFilters {
  /** 団体の活動カテゴリ */
  category?: string
  /** 案件場所または団体の活動地域 */
  region?: string
  /** 参加形態 */
  participationMode?: "online" | "offline"
}

export interface RecommendationResult {
  /** ルールベーススコア順の案件一覧 */
  recommendations: OpportunityRecommendation[]
  /** 診断が完了しているか（未診断でも推薦は返る。UIの案内表示用） */
  hasCompletedDiagnosis: boolean
}

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
  /** マッチングスコア (0-100) */
  matchScore: number
}

export interface RecommendationFilters {
  /** 団体の活動カテゴリ */
  category?: string
  /** 案件場所または団体の活動地域 */
  region?: string
}

export interface RecommendationResult {
  /** マッチングスコア順の案件一覧 */
  recommendations: OpportunityRecommendation[]
  /** 診断が完了しているか */
  hasCompletedDiagnosis: boolean
}

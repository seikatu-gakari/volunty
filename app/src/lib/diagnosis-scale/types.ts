/**
 * 診断尺度ドメイン型定義
 *
 * BIG5 の5ドメイン。Goldberg の Lexical Big-Five Factor Markers に従い、
 * 第4因子は「神経症傾向」ではなく「情緒安定性 (Emotional Stability)」、
 * 第5因子は「知性・想像性 (Intellect/Imagination)」として採点する。
 */
export type Big5Domain =
  | 'extraversion'
  | 'agreeableness'
  | 'conscientiousness'
  | 'emotionalStability'
  | 'intellect'

export const BIG5_DOMAINS: readonly Big5Domain[] = [
  'extraversion',
  'agreeableness',
  'conscientiousness',
  'emotionalStability',
  'intellect',
] as const

/** ドメインごとの日本語ラベル */
export const BIG5_DOMAIN_LABELS: Record<Big5Domain, string> = {
  extraversion: '外向性',
  agreeableness: '協調性',
  conscientiousness: '誠実性',
  emotionalStability: '情緒安定性',
  intellect: '知性・想像性',
}

/**
 * ドメインごとの価値中立な説明（高い/低いの両方向）。
 * 性格に良し悪しはなく、どちらの傾向にも活きる場面があることを伝える。
 */
export const BIG5_DOMAIN_DESCRIPTIONS: Record<
  Big5Domain,
  { high: string; low: string }
> = {
  extraversion: {
    high: '人と関わる場でエネルギーを得やすい傾向',
    low: '少人数や静かな環境で力を発揮しやすい傾向',
  },
  agreeableness: {
    high: '相手に寄り添った協力を大切にしやすい傾向',
    low: '自分の考えを率直に伝えやすい傾向',
  },
  conscientiousness: {
    high: '計画的に物事を進めやすい傾向',
    low: '状況に合わせて柔軟に動きやすい傾向',
  },
  emotionalStability: {
    high: 'プレッシャーのある場面でも落ち着きを保ちやすい傾向',
    low: '感情の変化に敏感で、細やかな気配りにつながりやすい傾向',
  },
  intellect: {
    high: '新しい考えや工夫を楽しみやすい傾向',
    low: '実績のある確実なやり方を大切にしやすい傾向',
  },
}

/** 尺度の1項目。日本語項目は出典の文言を改変せずに保持する */
export interface ScaleItem {
  /** 版をまたいで安定な項目識別子（例: ipip-bfm50-e01） */
  itemCode: string
  /** 日本語項目文（Nakayama 訳の原文のまま） */
  textJa: string
  /** 対応する英語原文（出典との対応検証用） */
  textEnOriginal: string
  domain: Big5Domain
  /** 採点方向。'-' は逆転項目（6 - 回答値 で採点） */
  keyed: '+' | '-'
  /** 一次資料での項目番号 = 出題順 (1〜50) */
  displayOrder: number
}

/** 診断モード。full=全50項目、brief=各ドメイン先頭3項目の簡易版（15項目） */
export type DiagnosisMode = 'full' | 'brief'

/** 尺度定義（設問・採点キー・出典・ライセンスの単一情報源） */
export interface ScaleDefinition {
  scaleCode: 'ipip-bfm-50-ja' | 'ipip-bfm-50-ja-brief15'
  /** 項目文言・順序の変更で更新する semver */
  scaleVersion: string
  name: string
  sourceUrl: string
  scoringKeyUrl: string
  license: string
  licenseVerifiedAt: string
  /** 日本語版の検証研究（存在する場合） */
  validationReference: string
  /**
   * 簡易版など、独自に項目を抜粋した尺度である場合の注記。
   * 抜粋版自体の心理測定的検証（信頼性・妥当性）は行われていないことを明示する。
   */
  excerptCaveat?: string
  items: ScaleItem[]
}

/** 診断の回答1件。elapsedMs / changedCount は回答品質判定用の任意メタデータ */
export interface DiagnosisAnswer {
  itemCode: string
  /** 5件法 (1=全く当てはまらない 〜 5=非常に当てはまる) */
  value: number
  /** この項目の回答にかかった時間（ミリ秒） */
  elapsedMs?: number
  /** 回答を変更した回数 */
  changedCount?: number
}

/** ドメインごとの数値（raw score / scaled score 共用） */
export type DomainScores = Record<Big5Domain, number>

/**
 * 採点結果。
 * rawScores はドメイン内10項目の合計（10〜50 の整数）で、丸め誤差のない正の値。
 * scaledScores は表示用の線形変換 (raw-10)/40*100（小数1桁）。
 * これは回答の換算値であり、母集団内の位置（percentile）ではない。
 */
export interface DiagnosisScore {
  rawScores: DomainScores
  scaledScores: DomainScores
  scaleCode: string
  scaleVersion: string
  scoringAlgorithmVersion: string
  /** 日本人向け標準化データが存在しないため当面 null */
  normsVersion: string | null
}

export type ScoringError =
  | { type: 'unknown_item'; itemCode: string }
  | { type: 'invalid_value'; itemCode: string; value: number }
  | { type: 'duplicate_answer'; itemCode: string }
  | { type: 'missing_answers'; missingItemCodes: string[] }

export type ScoringResult =
  | { success: true; score: DiagnosisScore }
  | { success: false; error: ScoringError; message: string }

/** 回答品質フラグ。性格特性の評価ではなく、結果の信頼性の参考情報 */
export type QualityFlag = 'too_fast' | 'straight_lining' | 'inconsistent'

export interface QualityContext {
  /** 診断全体の所要時間（ミリ秒）。不明な場合は undefined */
  totalDurationMs?: number
}

export interface QualityAssessment {
  flags: QualityFlag[]
  /** 同一選択肢の最長連続数（出題順） */
  longestStreak: number
  qualityRuleVersion: string
}

/**
 * 活動スタイルの参考タイプ。
 * 心理測定の本体ではなく、結果を理解しやすくするための補助的なナラティブ。
 * 断定（「あなたはこのタイプです」）や適性保証には使用しない。
 */
export type ActivityStyleId =
  | 'innovator-leader'
  | 'supporter-care'
  | 'creative-solo'
  | 'perfectionist-analyst'
  | 'charisma-entertainer'
  | 'strategist-planner'
  | 'harmony-mediator'
  | 'adventure-explorer'
  | 'conservative-guardian'
  | 'sensitive-artist'

export interface ActivityStyleType {
  id: ActivityStyleId
  name: string
  nameEn: string
  /** 傾向としての説明文（断定表現を含めない） */
  description: string
  /** 発揮しやすい傾向の例 */
  tendencies: string[]
  /** 力を発揮しやすい活動の例（参考情報） */
  activityExamples: string[]
  /** 代表プロファイル（scaled score 0-100） */
  profile: DomainScores
}

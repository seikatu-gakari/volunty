import { IPIP_BFM_50_JA, NORMS_VERSION, SCORING_ALGORITHM_VERSION } from './scale'
import type {
  Big5Domain,
  DiagnosisAnswer,
  DomainScores,
  ScaleDefinition,
  ScoringError,
  ScoringResult,
} from './types'
import { BIG5_DOMAINS } from './types'

/**
 * 診断採点（純粋関数）
 *
 * - 乱数・時刻・外部状態に依存せず、同じ回答と同じバージョンから常に同じ結果を返す
 * - 指定した尺度（デフォルトは全50項目版）の全項目回答が必須。部分回答での採点は行わない
 * - 逆転項目（-keyed）は 6 - 回答値 で採点する
 * - raw score はドメイン内項目数の合計（項目数〜項目数×5 の整数）
 * - scaled score は (raw - 項目数) / (項目数×4) * 100 を小数1桁で保持する。
 *   これは回答の線形変換であり、母集団内の位置（percentile）ではない
 */
export function scoreDiagnosis(
  answers: DiagnosisAnswer[],
  scale: ScaleDefinition = IPIP_BFM_50_JA
): ScoringResult {
  const itemByCode = new Map(scale.items.map((item) => [item.itemCode, item]))
  const seen = new Set<string>()
  const reversedValues = new Map<string, number>()

  for (const answer of answers) {
    const item = itemByCode.get(answer.itemCode)
    if (!item) {
      return failure({ type: 'unknown_item', itemCode: answer.itemCode })
    }
    if (seen.has(answer.itemCode)) {
      return failure({ type: 'duplicate_answer', itemCode: answer.itemCode })
    }
    if (!Number.isInteger(answer.value) || answer.value < 1 || answer.value > 5) {
      return failure({
        type: 'invalid_value',
        itemCode: answer.itemCode,
        value: answer.value,
      })
    }
    seen.add(answer.itemCode)
    reversedValues.set(
      answer.itemCode,
      item.keyed === '-' ? 6 - answer.value : answer.value
    )
  }

  const missingItemCodes = scale.items
    .filter((item) => !seen.has(item.itemCode))
    .map((item) => item.itemCode)
  if (missingItemCodes.length > 0) {
    return failure({ type: 'missing_answers', missingItemCodes })
  }

  const rawScores = emptyDomainScores()
  for (const item of scale.items) {
    const value = reversedValues.get(item.itemCode)
    if (value === undefined) {
      // missing_answers チェック後のため到達しない
      return failure({ type: 'missing_answers', missingItemCodes: [item.itemCode] })
    }
    rawScores[item.domain] += value
  }

  const itemCountByDomain = countItemsByDomain(scale)
  const scaledScores = emptyDomainScores()
  for (const domain of BIG5_DOMAINS) {
    scaledScores[domain] = toScaledScore(rawScores[domain], itemCountByDomain[domain])
  }

  return {
    success: true,
    score: {
      rawScores,
      scaledScores,
      scaleCode: scale.scaleCode,
      scaleVersion: scale.scaleVersion,
      scoringAlgorithmVersion: SCORING_ALGORITHM_VERSION,
      normsVersion: NORMS_VERSION,
    },
  }
}

function countItemsByDomain(scale: ScaleDefinition): DomainScores {
  const counts = emptyDomainScores()
  for (const item of scale.items) {
    counts[item.domain] += 1
  }
  return counts
}

/** raw score（項目数〜項目数×5）を表示用 0-100（小数1桁）へ線形変換する */
function toScaledScore(raw: number, itemCount: number): number {
  return Math.round(((raw - itemCount) / (itemCount * 4)) * 1000) / 10
}

function emptyDomainScores(): DomainScores {
  return {
    extraversion: 0,
    agreeableness: 0,
    conscientiousness: 0,
    emotionalStability: 0,
    intellect: 0,
  }
}

function failure(error: ScoringError): ScoringResult {
  return { success: false, error, message: toMessage(error) }
}

function toMessage(error: ScoringError): string {
  switch (error.type) {
    case 'unknown_item':
      return `回答に対応する質問が見つかりません: ${error.itemCode}`
    case 'invalid_value':
      return `回答値が不正です（1〜5の整数のみ有効）: ${error.itemCode}`
    case 'duplicate_answer':
      return `同じ質問への重複回答があります: ${error.itemCode}`
    case 'missing_answers':
      return `未回答の質問があります（${error.missingItemCodes.length}問）。すべての質問に回答してください`
  }
}

/** ドメインの型ガード（DB等の未知の値の検証用） */
export function isBig5Domain(value: unknown): value is Big5Domain {
  return typeof value === 'string' && (BIG5_DOMAINS as readonly string[]).includes(value)
}

/** 未知の値が DomainScores かどうかを検証する型ガード */
export function isDomainScores(value: unknown): value is DomainScores {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  return BIG5_DOMAINS.every((domain) => typeof obj[domain] === 'number')
}

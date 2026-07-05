import { findScaleItem, getItemsInDisplayOrder } from './scale'
import type {
  DiagnosisAnswer,
  QualityAssessment,
  QualityContext,
  QualityFlag,
} from './types'
import { BIG5_DOMAINS } from './types'

/**
 * 回答品質判定の版。閾値・判定条件の変更で更新する。
 * 閾値は恣意的な初期値であり、パイロットデータで調整する前提。
 */
export const QUALITY_RULE_VERSION = '1.0.0'

/** 1問あたりの最低想定回答時間（ミリ秒）。これ×項目数を下回ると too_fast */
const MIN_MS_PER_ITEM = 1_000

/** 同一選択肢の連続がこの数以上で straight_lining */
const STRAIGHT_LINING_THRESHOLD = 15

/** 逆転処理後のドメイン内標準偏差がこの値を超えるドメインの数 */
const INCONSISTENT_SD_THRESHOLD = 1.6
const INCONSISTENT_DOMAIN_COUNT = 2

/**
 * 回答品質を判定する（純粋関数）。
 *
 * 品質フラグは結果の信頼性の参考情報であり、性格特性の評価ではない。
 * スコア計算には一切影響させない。
 */
export function assessResponseQuality(
  answers: DiagnosisAnswer[],
  context: QualityContext
): QualityAssessment {
  const flags: QualityFlag[] = []

  if (
    context.totalDurationMs !== undefined &&
    context.totalDurationMs < answers.length * MIN_MS_PER_ITEM
  ) {
    flags.push('too_fast')
  }

  const longestStreak = calculateLongestStreak(answers)
  if (longestStreak >= STRAIGHT_LINING_THRESHOLD) {
    flags.push('straight_lining')
  }

  if (isInconsistent(answers)) {
    flags.push('inconsistent')
  }

  return { flags, longestStreak, qualityRuleVersion: QUALITY_RULE_VERSION }
}

/** 出題順に並べた回答列での同一選択肢の最長連続数 */
function calculateLongestStreak(answers: DiagnosisAnswer[]): number {
  const valueByCode = new Map(answers.map((a) => [a.itemCode, a.value]))
  const ordered = getItemsInDisplayOrder()
    .map((item) => valueByCode.get(item.itemCode))
    .filter((value): value is number => value !== undefined)

  let longest = 0
  let current = 0
  let prev: number | null = null
  for (const value of ordered) {
    current = value === prev ? current + 1 : 1
    prev = value
    if (current > longest) longest = current
  }
  return longest
}

/**
 * 逆転処理後のドメイン内標準偏差が極端に大きいドメインが複数ある場合、
 * +keyed / -keyed へ矛盾した回答をしている可能性が高いと判定する。
 */
function isInconsistent(answers: DiagnosisAnswer[]): boolean {
  const reversedByDomain = new Map<string, number[]>(
    BIG5_DOMAINS.map((domain) => [domain, []])
  )
  for (const answer of answers) {
    const item = findScaleItem(answer.itemCode)
    if (!item) continue
    const reversed = item.keyed === '-' ? 6 - answer.value : answer.value
    reversedByDomain.get(item.domain)?.push(reversed)
  }

  let inconsistentDomains = 0
  for (const values of reversedByDomain.values()) {
    if (values.length < 2) continue
    if (standardDeviation(values) > INCONSISTENT_SD_THRESHOLD) {
      inconsistentDomains++
    }
  }
  return inconsistentDomains >= INCONSISTENT_DOMAIN_COUNT
}

function standardDeviation(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance =
    values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length
  return Math.sqrt(variance)
}

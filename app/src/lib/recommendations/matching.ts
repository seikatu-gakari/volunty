import type { BIG5Scores } from "@/lib/personality/types"

/**
 * 参加者のBIG5スコアと案件の required_traits 間のマッチングスコアを計算する。
 *
 * ユークリッド距離を使ってスコア間の距離を算出し、0–100 のマッチングスコアに変換する。
 * required_traits に含まれていない特性は計算から除外する。
 *
 * @param participantScores - 参加者のBIG5スコア (0-100)
 * @param requiredTraits    - 案件が求める特性スコア (部分的に指定可)
 * @returns マッチングスコア (0-100、高いほど相性が良い)
 */
export function calculateMatchScore(
  participantScores: BIG5Scores,
  requiredTraits: Partial<BIG5Scores>
): number {
  const traits = [
    "extraversion",
    "agreeableness",
    "conscientiousness",
    "neuroticism",
    "openness",
  ] as const

  let sumOfSquares = 0
  let specifiedCount = 0

  for (const trait of traits) {
    const required = requiredTraits[trait]
    if (required === undefined) continue
    specifiedCount++
    const diff = participantScores[trait] - required
    sumOfSquares += diff * diff
  }

  // required_traits が未指定の場合はデフォルトスコア 50 を返す
  if (specifiedCount === 0) return 50

  const distance = Math.sqrt(sumOfSquares)
  // 各特性の最大差分は 100 なので、最大距離 = sqrt(specifiedCount) * 100
  const maxDistance = Math.sqrt(specifiedCount) * 100

  return Math.max(0, Math.round((1 - distance / maxDistance) * 100))
}

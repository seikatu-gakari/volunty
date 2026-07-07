import { describe, it, expect } from 'vitest'
import { IPIP_BFM_50_JA, IPIP_BFM_50_JA_BRIEF15 } from './scale'
import { assessResponseQuality, QUALITY_RULE_VERSION } from './quality'
import type { DiagnosisAnswer } from './types'

/** displayOrder 順に並んだ回答を作る */
function orderedAnswers(valueFor: (displayOrder: number) => number): DiagnosisAnswer[] {
  return [...IPIP_BFM_50_JA.items]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item) => ({ itemCode: item.itemCode, value: valueFor(item.displayOrder) }))
}

// 一様な「3」回答: straight_lining にはなるが inconsistent にはならない基準ケース
const uniformAnswers = orderedAnswers(() => 3)

describe('assessResponseQuality', () => {
  it('バージョンを持つ', () => {
    expect(QUALITY_RULE_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  describe('too_fast（総所要時間 < 項目数×1秒）', () => {
    it('50問を49秒で回答すると too_fast', () => {
      const result = assessResponseQuality(uniformAnswers, { totalDurationMs: 49_000 })
      expect(result.flags).toContain('too_fast')
    })

    it('50問を50秒以上かけていれば too_fast ではない', () => {
      const result = assessResponseQuality(uniformAnswers, { totalDurationMs: 50_000 })
      expect(result.flags).not.toContain('too_fast')
    })

    it('所要時間が不明（undefined）の場合は too_fast を付けない', () => {
      const result = assessResponseQuality(uniformAnswers, {})
      expect(result.flags).not.toContain('too_fast')
    })
  })

  describe('straight_lining（同一選択肢が15問以上連続）', () => {
    it('全問同じ選択肢なら straight_lining', () => {
      const result = assessResponseQuality(uniformAnswers, { totalDurationMs: 300_000 })
      expect(result.flags).toContain('straight_lining')
      expect(result.longestStreak).toBe(50)
    })

    it('15問連続で straight_lining になる', () => {
      // 先頭15問(displayOrder 1..15)が5、以降は 2/4 交互
      const answers = orderedAnswers((order) =>
        order <= 15 ? 5 : order % 2 === 0 ? 2 : 4
      )
      const result = assessResponseQuality(answers, { totalDurationMs: 300_000 })
      expect(result.flags).toContain('straight_lining')
      expect(result.longestStreak).toBe(15)
    })

    it('最長14問連続なら straight_lining ではない', () => {
      const answers = orderedAnswers((order) =>
        order <= 14 ? 5 : order % 2 === 0 ? 2 : 4
      )
      const result = assessResponseQuality(answers, { totalDurationMs: 300_000 })
      expect(result.flags).not.toContain('straight_lining')
      expect(result.longestStreak).toBe(14)
    })
  })

  describe('inconsistent（逆転処理後のドメイン内ばらつきが極端）', () => {
    it('+keyed/-keyed の双方に「5」を付ける矛盾回答が2ドメイン以上あると inconsistent', () => {
      // E・A の全項目に5（+keyedは5のまま、-keyedは逆転後1 -> SD=2.0）
      // 他ドメインは3固定。表示順は E,A,C,ES,I の循環なので直線回答にはならない
      const answers = orderedAnswers(() => 3).map((answer) => {
        const item = IPIP_BFM_50_JA.items.find((i) => i.itemCode === answer.itemCode)
        if (!item) throw new Error('unreachable')
        if (item.domain === 'extraversion' || item.domain === 'agreeableness') {
          return { ...answer, value: 5 }
        }
        return answer
      })
      const result = assessResponseQuality(answers, { totalDurationMs: 300_000 })
      expect(result.flags).toContain('inconsistent')
      expect(result.flags).not.toContain('straight_lining')
    })

    it('一貫した回答（逆転項目に逆方向の回答）では inconsistent にならない', () => {
      const answers = IPIP_BFM_50_JA.items.map((item) => ({
        itemCode: item.itemCode,
        value: item.keyed === '+' ? 4 : 2,
      }))
      const result = assessResponseQuality(answers, { totalDurationMs: 300_000 })
      expect(result.flags).not.toContain('inconsistent')
    })
  })

  it('良質な回答ではフラグが空になる', () => {
    const answers = orderedAnswers((order) => {
      const item = IPIP_BFM_50_JA.items.find((i) => i.displayOrder === order)
      if (!item) throw new Error('unreachable')
      return item.keyed === '+' ? 4 : 2
    })
    const result = assessResponseQuality(answers, { totalDurationMs: 300_000 })
    expect(result.flags).toEqual([])
  })

  it('品質判定はスコアを変更しない（参照情報のみを返す）', () => {
    const result = assessResponseQuality(uniformAnswers, { totalDurationMs: 10_000 })
    expect(result).not.toHaveProperty('rawScores')
    expect(result).not.toHaveProperty('scaledScores')
  })
})

describe('assessResponseQuality 簡易版（15項目）', () => {
  function briefOrderedAnswers(valueFor: (displayOrder: number) => number): DiagnosisAnswer[] {
    return [...IPIP_BFM_50_JA_BRIEF15.items]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => ({ itemCode: item.itemCode, value: valueFor(item.displayOrder) }))
  }

  it('15問を14秒で回答すると too_fast（項目数に応じて閾値が縮小する）', () => {
    const answers = briefOrderedAnswers(() => 3)
    const result = assessResponseQuality(answers, { totalDurationMs: 14_000 }, IPIP_BFM_50_JA_BRIEF15)
    expect(result.flags).toContain('too_fast')
  })

  it('15問全問同じ選択肢なら straight_lining（15項目の30%基準では最低5問で足りる）', () => {
    const answers = briefOrderedAnswers(() => 4)
    const result = assessResponseQuality(answers, { totalDurationMs: 60_000 }, IPIP_BFM_50_JA_BRIEF15)
    expect(result.flags).toContain('straight_lining')
    expect(result.longestStreak).toBe(15)
  })

  it('4問連続では straight_lining にならない（15項目では閾値5）', () => {
    const answers = briefOrderedAnswers((order) => (order <= 4 ? 5 : order % 2 === 0 ? 2 : 4))
    const result = assessResponseQuality(answers, { totalDurationMs: 60_000 }, IPIP_BFM_50_JA_BRIEF15)
    expect(result.flags).not.toContain('straight_lining')
  })

  it('5問連続で straight_lining になる（15項目では閾値5）', () => {
    const answers = briefOrderedAnswers((order) => (order <= 5 ? 5 : order % 2 === 0 ? 2 : 4))
    const result = assessResponseQuality(answers, { totalDurationMs: 60_000 }, IPIP_BFM_50_JA_BRIEF15)
    expect(result.flags).toContain('straight_lining')
  })
})

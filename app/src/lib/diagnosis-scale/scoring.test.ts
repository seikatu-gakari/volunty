import { describe, it, expect } from 'vitest'
import { IPIP_BFM_50_JA, IPIP_BFM_50_JA_BRIEF15, SCORING_ALGORITHM_VERSION } from './scale'
import { scoreDiagnosis } from './scoring'
import type { Big5Domain, DiagnosisAnswer } from './types'

/**
 * 公式採点キー（https://ipip.ori.org/newBigFive5broadKey.htm）から
 * 独立に手計算した期待値で検証する。
 *
 * raw score = ドメイン内10項目の合計（-keyed は 6-値 に変換）。範囲 10〜50。
 * scaled = (raw - 10) / 40 * 100（小数1桁）。
 */

function answersWithValue(value: number): DiagnosisAnswer[] {
  return IPIP_BFM_50_JA.items.map((item) => ({ itemCode: item.itemCode, value }))
}

/** keyed に応じて値を出し分けた回答を作る */
function answersByKey(plusValue: number, minusValue: number): DiagnosisAnswer[] {
  return IPIP_BFM_50_JA.items.map((item) => ({
    itemCode: item.itemCode,
    value: item.keyed === '+' ? plusValue : minusValue,
  }))
}

describe('scoreDiagnosis 採点', () => {
  it('全項目「非常に当てはまる(5)」: 手計算fixtureと一致する', () => {
    // E(5+/5-): 5*5 + 5*1 = 30 -> 50.0
    // A(6+/4-): 6*5 + 4*1 = 34 -> 60.0
    // C(6+/4-): 34 -> 60.0
    // ES(2+/8-): 2*5 + 8*1 = 18 -> 20.0
    // I(7+/3-): 7*5 + 3*1 = 38 -> 70.0
    const result = scoreDiagnosis(answersWithValue(5))
    if (!result.success) throw new Error(result.message)
    expect(result.score.rawScores).toEqual({
      extraversion: 30,
      agreeableness: 34,
      conscientiousness: 34,
      emotionalStability: 18,
      intellect: 38,
    })
    expect(result.score.scaledScores).toEqual({
      extraversion: 50.0,
      agreeableness: 60.0,
      conscientiousness: 60.0,
      emotionalStability: 20.0,
      intellect: 70.0,
    })
  })

  it('全項目「全く当てはまらない(1)」: 手計算fixtureと一致する', () => {
    // E: 5*1 + 5*5 = 30 -> 50.0 / A: 6*1+4*5 = 26 -> 40.0 / C: 26 -> 40.0
    // ES: 2*1+8*5 = 42 -> 80.0 / I: 7*1+3*5 = 22 -> 30.0
    const result = scoreDiagnosis(answersWithValue(1))
    if (!result.success) throw new Error(result.message)
    expect(result.score.rawScores).toEqual({
      extraversion: 30,
      agreeableness: 26,
      conscientiousness: 26,
      emotionalStability: 42,
      intellect: 22,
    })
  })

  it('全項目「どちらともいえない(3)」: 全ドメイン raw 30 / scaled 50', () => {
    const result = scoreDiagnosis(answersWithValue(3))
    if (!result.success) throw new Error(result.message)
    const domains = Object.keys(result.score.rawScores) as Big5Domain[]
    for (const domain of domains) {
      expect(result.score.rawScores[domain]).toBe(30)
      expect(result.score.scaledScores[domain]).toBe(50.0)
    }
  })

  it('+keyed=5 / -keyed=1 で全ドメイン最大 (raw 50 / scaled 100)', () => {
    const result = scoreDiagnosis(answersByKey(5, 1))
    if (!result.success) throw new Error(result.message)
    const domains = Object.keys(result.score.rawScores) as Big5Domain[]
    for (const domain of domains) {
      expect(result.score.rawScores[domain]).toBe(50)
      expect(result.score.scaledScores[domain]).toBe(100.0)
    }
  })

  it('+keyed=1 / -keyed=5 で全ドメイン最小 (raw 10 / scaled 0)', () => {
    const result = scoreDiagnosis(answersByKey(1, 5))
    if (!result.success) throw new Error(result.message)
    const domains = Object.keys(result.score.rawScores) as Big5Domain[]
    for (const domain of domains) {
      expect(result.score.rawScores[domain]).toBe(10)
      expect(result.score.scaledScores[domain]).toBe(0.0)
    }
  })

  it('外向性のみ +4/-2、他は3: 逆転処理を含む手計算fixtureと一致する', () => {
    // E: 5項目が4、5項目が 6-2=4 -> raw 40 -> scaled 75.0。他ドメインは 30 -> 50.0
    const answers: DiagnosisAnswer[] = IPIP_BFM_50_JA.items.map((item) => {
      if (item.domain !== 'extraversion') return { itemCode: item.itemCode, value: 3 }
      return { itemCode: item.itemCode, value: item.keyed === '+' ? 4 : 2 }
    })
    const result = scoreDiagnosis(answers)
    if (!result.success) throw new Error(result.message)
    expect(result.score.rawScores.extraversion).toBe(40)
    expect(result.score.scaledScores.extraversion).toBe(75.0)
    expect(result.score.rawScores.agreeableness).toBe(30)
  })

  it('scaled score は小数1桁で保持される', () => {
    // 1項目だけ4、残り3 -> raw 31 -> (21/40)*100 = 52.5
    const answers: DiagnosisAnswer[] = IPIP_BFM_50_JA.items.map((item, idx) => ({
      itemCode: item.itemCode,
      value: idx === 0 && item.keyed === '+' ? 4 : 3,
    }))
    const first = IPIP_BFM_50_JA.items[0]
    const result = scoreDiagnosis(answers)
    if (!result.success) throw new Error(result.message)
    expect(result.score.scaledScores[first.domain]).toBe(52.5)
  })

  it('決定性: 同じ回答からは常に同じ結果、回答順にも依存しない', () => {
    const answers = answersByKey(4, 2)
    const shuffled = [...answers].reverse()
    const a = scoreDiagnosis(answers)
    const b = scoreDiagnosis(answers)
    const c = scoreDiagnosis(shuffled)
    expect(a).toEqual(b)
    expect(a).toEqual(c)
  })

  it('結果に尺度・採点・標準化のバージョンが含まれる', () => {
    const result = scoreDiagnosis(answersWithValue(3))
    if (!result.success) throw new Error(result.message)
    expect(result.score.scaleCode).toBe('ipip-bfm-50-ja')
    expect(result.score.scaleVersion).toBe(IPIP_BFM_50_JA.scaleVersion)
    expect(result.score.scoringAlgorithmVersion).toBe(SCORING_ALGORITHM_VERSION)
    expect(result.score.normsVersion).toBeNull()
  })
})

describe('scoreDiagnosis バリデーション', () => {
  it('不正な質問IDを拒否する', () => {
    const answers = answersWithValue(3)
    answers[0] = { itemCode: 'unknown-item', value: 3 }
    const result = scoreDiagnosis(answers)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.type).toBe('unknown_item')
  })

  it.each([0, 6, 2.5, NaN])('範囲外・非整数の回答値 %s を拒否する', (value) => {
    const answers = answersWithValue(3)
    answers[10] = { ...answers[10], value }
    const result = scoreDiagnosis(answers)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.type).toBe('invalid_value')
  })

  it('重複回答を拒否する', () => {
    const answers = answersWithValue(3)
    answers[1] = { ...answers[0] }
    const result = scoreDiagnosis(answers)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.type).toBe('duplicate_answer')
  })

  it('未回答（50問未満）を拒否し、不足itemCodeを返す', () => {
    const answers = answersWithValue(3).slice(0, 49)
    const missing = IPIP_BFM_50_JA.items[49].itemCode
    const result = scoreDiagnosis(answers)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.type).toBe('missing_answers')
    if (result.error.type !== 'missing_answers') return
    expect(result.error.missingItemCodes).toContain(missing)
  })

  it('エラーメッセージは日本語で返る', () => {
    const result = scoreDiagnosis([])
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.message).toMatch(/回答/)
  })
})

describe('scoreDiagnosis 簡易版（15項目・ドメイン3項目）', () => {
  it('全項目「非常に当てはまる(5)」: ドメイン内訳に応じた raw/scaled になる', () => {
    // 簡易版の内訳は e01(+) e02(-) e03(+) / a01(-) a02(+) a03(-) / c01(+) c02(-) c03(+)
    // / s01(-) s02(+) s03(-) / i01(+) i02(-) i03(+)
    // E(2+/1-): 5*2 + 1*1 = 11 -> (11-3)/12*100 = 66.7
    // A(1+/2-): 5*1 + 1*2 = 7  -> (7-3)/12*100 = 33.3
    const answers: DiagnosisAnswer[] = IPIP_BFM_50_JA_BRIEF15.items.map((item) => ({
      itemCode: item.itemCode,
      value: 5,
    }))
    const result = scoreDiagnosis(answers, IPIP_BFM_50_JA_BRIEF15)
    if (!result.success) throw new Error(result.message)
    expect(result.score.rawScores.extraversion).toBe(11)
    expect(result.score.scaledScores.extraversion).toBe(66.7)
    expect(result.score.rawScores.agreeableness).toBe(7)
    expect(result.score.scaledScores.agreeableness).toBe(33.3)
  })

  it('全ドメイン「どちらともいえない(3)」: raw 9 / scaled 50', () => {
    const answers: DiagnosisAnswer[] = IPIP_BFM_50_JA_BRIEF15.items.map((item) => ({
      itemCode: item.itemCode,
      value: 3,
    }))
    const result = scoreDiagnosis(answers, IPIP_BFM_50_JA_BRIEF15)
    if (!result.success) throw new Error(result.message)
    const domains = Object.keys(result.score.rawScores) as Big5Domain[]
    for (const domain of domains) {
      expect(result.score.rawScores[domain]).toBe(9)
      expect(result.score.scaledScores[domain]).toBe(50.0)
    }
  })

  it('15問未満の回答を拒否する（簡易版は15項目必須）', () => {
    const answers: DiagnosisAnswer[] = IPIP_BFM_50_JA_BRIEF15.items
      .slice(0, 14)
      .map((item) => ({ itemCode: item.itemCode, value: 3 }))
    const result = scoreDiagnosis(answers, IPIP_BFM_50_JA_BRIEF15)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.type).toBe('missing_answers')
  })

  it('50項目版の項目を簡易版として採点しようとすると不明な質問として拒否される', () => {
    const fullOnlyItem = IPIP_BFM_50_JA.items.find(
      (item) => !IPIP_BFM_50_JA_BRIEF15.items.some((brief) => brief.itemCode === item.itemCode)
    )
    if (!fullOnlyItem) throw new Error('fixture error')
    const answers: DiagnosisAnswer[] = [
      ...IPIP_BFM_50_JA_BRIEF15.items.slice(0, 14).map((item) => ({ itemCode: item.itemCode, value: 3 })),
      { itemCode: fullOnlyItem.itemCode, value: 3 },
    ]
    const result = scoreDiagnosis(answers, IPIP_BFM_50_JA_BRIEF15)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.type).toBe('unknown_item')
  })

  it('結果の scaleCode/scaleVersion は簡易版のものになる', () => {
    const answers: DiagnosisAnswer[] = IPIP_BFM_50_JA_BRIEF15.items.map((item) => ({
      itemCode: item.itemCode,
      value: 3,
    }))
    const result = scoreDiagnosis(answers, IPIP_BFM_50_JA_BRIEF15)
    if (!result.success) throw new Error(result.message)
    expect(result.score.scaleCode).toBe('ipip-bfm-50-ja-brief15')
    expect(result.score.scaleVersion).toBe(IPIP_BFM_50_JA_BRIEF15.scaleVersion)
  })
})

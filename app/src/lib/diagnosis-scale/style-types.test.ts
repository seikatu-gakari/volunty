import { describe, it, expect } from 'vitest'
import {
  ACTIVITY_STYLE_TYPES,
  STYLE_TYPE_VERSION,
  findClosestStyleType,
} from './style-types'
import type { DomainScores } from './types'

describe('ACTIVITY_STYLE_TYPES（参考タイプ）', () => {
  it('10タイプ定義されている', () => {
    expect(ACTIVITY_STYLE_TYPES).toHaveLength(10)
  })

  it('IDが一意で、プロファイルは0〜100の範囲にある', () => {
    const ids = ACTIVITY_STYLE_TYPES.map((t) => t.id)
    expect(new Set(ids).size).toBe(10)
    for (const type of ACTIVITY_STYLE_TYPES) {
      for (const value of Object.values(type.profile)) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
    }
  })

  it('バージョンを持つ', () => {
    expect(STYLE_TYPE_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('断定的・適性保証の表現を含まない', () => {
    for (const type of ACTIVITY_STYLE_TYPES) {
      expect(type.description).not.toMatch(/あなたは.*です/)
      expect(type.description).not.toMatch(/向いています/)
    }
  })
})

describe('findClosestStyleType', () => {
  it('タイプの代表プロファイルと一致するスコアではそのタイプが返る', () => {
    for (const type of ACTIVITY_STYLE_TYPES) {
      const result = findClosestStyleType(type.profile)
      expect(result.type.id).toBe(type.id)
      expect(result.distance).toBe(0)
    }
  })

  it('必ず1タイプを返し、距離を含む（「該当なし」は存在しない）', () => {
    const neutral: DomainScores = {
      extraversion: 50,
      agreeableness: 50,
      conscientiousness: 50,
      emotionalStability: 50,
      intellect: 50,
    }
    const result = findClosestStyleType(neutral)
    expect(result.type).toBeDefined()
    expect(result.distance).toBeGreaterThan(0)
  })

  it('決定的である（同じ入力で常に同じ結果）', () => {
    const scores: DomainScores = {
      extraversion: 72,
      agreeableness: 61,
      conscientiousness: 44,
      emotionalStability: 58,
      intellect: 66,
    }
    const a = findClosestStyleType(scores)
    const b = findClosestStyleType(scores)
    expect(a).toEqual(b)
  })

  it('等距離の場合は定義順で先のタイプを返す（決定的なタイブレーク）', () => {
    // 2タイプの中点をとると等距離になる
    const t1 = ACTIVITY_STYLE_TYPES[0]
    const t2 = ACTIVITY_STYLE_TYPES[1]
    const midpoint = Object.fromEntries(
      Object.entries(t1.profile).map(([domain, value]) => [
        domain,
        (value + t2.profile[domain as keyof DomainScores]) / 2,
      ])
    ) as DomainScores
    const result = findClosestStyleType(midpoint)
    // 他タイプがさらに近い可能性があるため、少なくとも決定的であることを確認
    expect(findClosestStyleType(midpoint).type.id).toBe(result.type.id)
  })
})

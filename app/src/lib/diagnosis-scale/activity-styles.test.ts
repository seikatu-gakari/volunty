import { describe, expect, it } from 'vitest'
import { ACTIVITY_STYLE_DIRECTIONS, ACTIVITY_STYLE_VERSION, classifyActivityStyle, findActivityStyleById } from './activity-styles'
import { ACTIVITY_STYLE_TYPES, findStyleTypeById, findStyleTypeLabel } from './style-types'
import { BIG5_DOMAINS, type DomainScores } from './types'

const CENTER: DomainScores = { extraversion: 50, agreeableness: 50, conscientiousness: 50, emotionalStability: 50, intellect: 50 }

describe('活動スタイルv2', () => {
  it('全50点は中立で、元のスコアを変更しない', () => {
    const scores = { ...CENTER }
    expect(classifyActivityStyle(scores)).toMatchObject({ id: 'v2:neutral', classificationKind: 'neutral', directions: [] })
    expect(scores).toEqual(CENTER)
  })
  it.each(ACTIVITY_STYLE_DIRECTIONS)('$id の対称アンカーで単独方向を返す', (direction) => {
    expect(classifyActivityStyle(direction.profile)).toMatchObject({ id: `v2:${direction.id}`, classificationKind: 'single', directions: [direction] })
    expect(Object.values(direction.profile).filter((value) => value === 50)).toHaveLength(4)
    expect(direction.profile[direction.domain]).toBe(direction.direction === 'high' ? 75 : 25)
  })
  it.each([2, 3, 4, 5])('%i方向同点は全方向を保持する', (count) => {
    const scores = { ...CENTER }
    BIG5_DOMAINS.slice(0, count).forEach((domain, index) => { scores[domain] = index % 2 === 0 ? 75 : 25 })
    const style = classifyActivityStyle(scores)
    expect(style.classificationKind).toBe('mixed')
    expect(style.directions).toHaveLength(count)
    expect(style.id.length).toBeLessThanOrEqual(50)
    expect(findActivityStyleById(style.id)).toEqual(style)
  })
  it('中立境界15と混合差10は厳密に扱い、近接候補を省略しない', () => {
    expect(classifyActivityStyle({ ...CENTER, extraversion: 64.9 }).classificationKind).toBe('neutral')
    expect(classifyActivityStyle({ ...CENTER, extraversion: 65 }).classificationKind).toBe('single')
    expect(classifyActivityStyle({ ...CENTER, extraversion: 75, agreeableness: 65 }).directions).toHaveLength(1)
    expect(classifyActivityStyle({ ...CENTER, extraversion: 75, agreeableness: 65.1, intellect: 34.9 }).directions).toHaveLength(3)
  })
  it('簡易約8.3点と全50問2.5点の刻みの境界感度を明示する', () => {
    expect(classifyActivityStyle({ ...CENTER, extraversion: 58.3 }).classificationKind).toBe('neutral')
    expect(classifyActivityStyle({ ...CENTER, extraversion: 66.7 }).classificationKind).toBe('single')
    expect(classifyActivityStyle({ ...CENTER, extraversion: 62.5 }).classificationKind).toBe('neutral')
    expect(classifyActivityStyle({ ...CENTER, extraversion: 65 }).classificationKind).toBe('single')
  })
  it.each([NaN, Infinity, -1, 101, undefined])('不正値 %s を中立や任意の方向に変換しない', (value) => {
    expect(() => classifyActivityStyle({ ...CENTER, extraversion: value } as DomainScores)).toThrow()
  })
  it.each(['v2:', 'v2:unknown', 'v2:e-high,e-high', 'v2:e-high,e-low', 'v2:a-high,e-high', 'v3:neutral', 'toString'])('非正規ID %s を拒否する', (id) => {
    expect(findActivityStyleById(id)).toBeUndefined()
  })
  it('旧IDと版を維持し、未来版・不整合版を解釈しない', () => {
    for (const legacy of ACTIVITY_STYLE_TYPES) expect(findStyleTypeById(legacy.id, '1.0.0')).toEqual(legacy)
    expect(findStyleTypeById('supporter-care', 'legacy')?.id).toBe('supporter-care')
    expect(findStyleTypeLabel('v2:e-high,a-high,c-high', ACTIVITY_STYLE_VERSION)).toContain('交流 / 調和 / 計画・秩序')
    expect(findStyleTypeById('supporter-care', ACTIVITY_STYLE_VERSION)).toBeUndefined()
    expect(findStyleTypeById('v2:neutral', '1.0.0')).toBeUndefined()
    expect(findStyleTypeById('v2:neutral', '3.0.0')).toBeUndefined()
    expect(findStyleTypeById('v2:neutral', ACTIVITY_STYLE_VERSION)?.classificationKind).toBe('neutral')
  })
  it('合成直積データの軸・符号対称性を保つ（実人口の頻度ではない）', () => {
    const counts = Object.fromEntries(ACTIVITY_STYLE_DIRECTIONS.map(({ id }) => [id, 0]))
    const values = [0, 25, 50, 75, 100]
    for (let combination = 0; combination < 3125; combination++) {
      let remainder = combination
      const scores = { ...CENTER }
      for (const domain of BIG5_DOMAINS) { scores[domain] = values[remainder % 5]; remainder = Math.floor(remainder / 5) }
      const style = classifyActivityStyle(scores)
      expect(findActivityStyleById(style.id)).toEqual(style)
      for (const direction of style.directions ?? []) counts[direction.id]++
    }
    expect(new Set(Object.values(counts)).size).toBe(1)
  })
})

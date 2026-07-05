import { describe, it, expect } from 'vitest'
import {
  MATCHING_RULE_VERSION,
  filterEligibleOpportunities,
  rankOpportunities,
} from './engine'
import { ACTIVITY_STYLE_TAGS, findActivityStyleTag } from './activity-style-tags'
import type { OpportunityFeatures, ParticipantFeatures } from './engine'

const NOW = new Date('2026-07-04T09:00:00+09:00')

function participant(overrides: Partial<ParticipantFeatures> = {}): ParticipantFeatures {
  return {
    interests: [],
    region: null,
    availabilityWeekdays: [],
    preferredParticipationMode: null,
    scaledScores: null,
    ageYears: null,
    ...overrides,
  }
}

function opportunity(overrides: Partial<OpportunityFeatures> = {}): OpportunityFeatures {
  return {
    id: 'opp-1',
    category: null,
    location: null,
    organizationActivityAreas: [],
    participationMode: null,
    startDate: null,
    endDate: null,
    publishedAt: new Date('2026-07-04T00:00:00+09:00'),
    capacity: null,
    currentApplicants: 0,
    activityStyleTags: [],
    minAge: null,
    maxAge: null,
    ...overrides,
  }
}

const fullScores = {
  extraversion: 80,
  agreeableness: 70,
  conscientiousness: 60,
  emotionalStability: 50,
  intellect: 40,
}

describe('ACTIVITY_STYLE_TAGS', () => {
  it('各タグはドメインと方向を持ち、IDが一意である', () => {
    expect(ACTIVITY_STYLE_TAGS.length).toBeGreaterThanOrEqual(6)
    const ids = ACTIVITY_STYLE_TAGS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const tag of ACTIVITY_STYLE_TAGS) {
      expect(['high', 'low']).toContain(tag.direction)
      expect(tag.label.length).toBeGreaterThan(0)
    }
  })
})

describe('filterEligibleOpportunities（ハード条件）', () => {
  it('終了日が過去の案件を除外する', () => {
    const past = opportunity({ id: 'past', endDate: new Date('2026-07-03T00:00:00+09:00') })
    const today = opportunity({ id: 'today', endDate: new Date('2026-07-04T00:00:00+09:00') })
    const future = opportunity({ id: 'future', endDate: new Date('2026-08-01T00:00:00+09:00') })
    const result = filterEligibleOpportunities(participant(), [past, today, future], NOW)
    expect(result.eligible.map((o) => o.id)).toEqual(['today', 'future'])
    expect(result.excluded).toEqual([{ id: 'past', reason: 'ended' }])
  })

  it('終了日がなく開始日が過去の案件も除外する', () => {
    const past = opportunity({ id: 'past', startDate: new Date('2026-07-01T00:00:00+09:00') })
    const result = filterEligibleOpportunities(participant(), [past], NOW)
    expect(result.eligible).toEqual([])
  })

  it('定員に達した案件を除外する', () => {
    const full = opportunity({ id: 'full', capacity: 10, currentApplicants: 10 })
    const open = opportunity({ id: 'open', capacity: 10, currentApplicants: 9 })
    const result = filterEligibleOpportunities(participant(), [full, open], NOW)
    expect(result.eligible.map((o) => o.id)).toEqual(['open'])
    expect(result.excluded).toEqual([{ id: 'full', reason: 'capacity_full' }])
  })

  it('年齢要件を満たさない案件を除外する', () => {
    const adult = opportunity({ id: 'adult', minAge: 18 })
    const youth = opportunity({ id: 'youth', maxAge: 25 })
    const result = filterEligibleOpportunities(participant({ ageYears: 17 }), [adult, youth], NOW)
    expect(result.eligible.map((o) => o.id)).toEqual(['youth'])
    expect(result.excluded).toEqual([{ id: 'adult', reason: 'age_requirement' }])
  })

  it('年齢が不明な場合は年齢要件で除外しない', () => {
    const adult = opportunity({ id: 'adult', minAge: 18 })
    const result = filterEligibleOpportunities(participant({ ageYears: null }), [adult], NOW)
    expect(result.eligible.map((o) => o.id)).toEqual(['adult'])
  })

  it('性格スコアはハード条件に使われない（未診断でも除外されない）', () => {
    const withTags = opportunity({ id: 'tagged', activityStyleTags: ['talk-with-new-people'] })
    const result = filterEligibleOpportunities(
      participant({ scaledScores: null }),
      [withTags],
      NOW
    )
    expect(result.eligible.map((o) => o.id)).toEqual(['tagged'])
  })
})

describe('rankOpportunities（ルールベースランキング）', () => {
  it('興味分野一致は不一致よりも上位になる', () => {
    const p = participant({ interests: ['子ども支援'] })
    const matched = opportunity({ id: 'matched', category: '子ども支援' })
    const unmatched = opportunity({ id: 'unmatched', category: '環境保全' })
    const ranked = rankOpportunities(p, [unmatched, matched], NOW)
    expect(ranked[0].opportunityId).toBe('matched')
    expect(ranked[0].totalScore).toBeGreaterThan(ranked[1].totalScore)
  })

  it('欠損した特徴の重みは再正規化される（興味一致のみで total 1 になる）', () => {
    // 参加者は興味のみ保有、案件はカテゴリのみ保有（鮮度は同日公開=1.0）
    const p = participant({ interests: ['環境保全'] })
    const opp = opportunity({ id: 'only-category', category: '環境保全', publishedAt: NOW })
    const ranked = rankOpportunities(p, [opp], NOW)
    expect(ranked[0].totalScore).toBeCloseTo(1.0, 5)
  })

  it('地域: 案件所在地に居住地域を含む場合に加点される', () => {
    const p = participant({ region: '東京都' })
    const local = opportunity({ id: 'local', location: '東京都渋谷区' })
    const remote = opportunity({ id: 'remote', location: '大阪府大阪市' })
    const ranked = rankOpportunities(p, [remote, local], NOW)
    expect(ranked[0].opportunityId).toBe('local')
  })

  it('地域: オンライン案件は地域に関わらず加点される', () => {
    const p = participant({ region: '北海道' })
    const online = opportunity({ id: 'online', participationMode: 'online', location: null })
    const ranked = rankOpportunities(p, [online], NOW)
    const regionRule = ranked[0].ruleContributions.find((r) => r.ruleId === 'region')
    expect(regionRule?.normalizedValue).toBe(1)
  })

  it('日程: 7日以上の期間はどの希望曜日とも適合する', () => {
    const p = participant({ availabilityWeekdays: ['土', '日'] })
    const longTerm = opportunity({
      id: 'long',
      startDate: new Date('2026-07-06T00:00:00+09:00'),
      endDate: new Date('2026-07-20T00:00:00+09:00'),
    })
    const ranked = rankOpportunities(p, [longTerm], NOW)
    const rule = ranked[0].ruleContributions.find((r) => r.ruleId === 'schedule')
    expect(rule?.normalizedValue).toBe(1)
  })

  it('日程: 単日開催は曜日が合わなければ0になる', () => {
    // 2026-07-06 は月曜日
    const p = participant({ availabilityWeekdays: ['土', '日'] })
    const monday = opportunity({
      id: 'monday',
      startDate: new Date('2026-07-06T00:00:00+09:00'),
      endDate: new Date('2026-07-06T00:00:00+09:00'),
    })
    const ranked = rankOpportunities(p, [monday], NOW)
    const rule = ranked[0].ruleContributions.find((r) => r.ruleId === 'schedule')
    expect(rule?.normalizedValue).toBe(0)
  })

  it('性格適合: highタグはスコア60以上で加点、逆方向でも減点しない', () => {
    const p = participant({ scaledScores: fullScores }) // extraversion 80
    const tag = findActivityStyleTag('talk-with-new-people')
    expect(tag?.domain).toBe('extraversion')
    expect(tag?.direction).toBe('high')

    const social = opportunity({ id: 'social', activityStyleTags: ['talk-with-new-people'] })
    const solo = opportunity({ id: 'solo', activityStyleTags: ['solo-focused-work'] })
    const ranked = rankOpportunities(p, [solo, social], NOW)
    const socialRanked = ranked.find((r) => r.opportunityId === 'social')
    const soloRanked = ranked.find((r) => r.opportunityId === 'solo')
    const socialFit = socialRanked?.ruleContributions.find((r) => r.ruleId === 'personality')
    const soloFit = soloRanked?.ruleContributions.find((r) => r.ruleId === 'personality')
    expect(socialFit?.normalizedValue).toBe(1)
    // 外向性80 は low タグに合致しないが、0止まり（マイナスにならない）
    expect(soloFit?.normalizedValue).toBe(0)
  })

  it('性格適合: 未診断の場合は重みが再正規化され、案件は除外されない', () => {
    const p = participant({ interests: ['環境保全'], scaledScores: null })
    const opp = opportunity({
      id: 'opp',
      category: '環境保全',
      activityStyleTags: ['talk-with-new-people'],
      publishedAt: NOW,
    })
    const ranked = rankOpportunities(p, [opp], NOW)
    expect(ranked).toHaveLength(1)
    expect(ranked[0].ruleContributions.some((r) => r.ruleId === 'personality')).toBe(false)
    expect(ranked[0].totalScore).toBeCloseTo(1.0, 5)
  })

  it('鮮度: 公開直後は1に近く、30日経過で約0.37に減衰する', () => {
    const fresh = opportunity({ id: 'fresh', publishedAt: NOW })
    const stale = opportunity({
      id: 'stale',
      publishedAt: new Date('2026-06-04T09:00:00+09:00'),
    })
    const ranked = rankOpportunities(participant(), [stale, fresh], NOW)
    const freshRule = ranked
      .find((r) => r.opportunityId === 'fresh')
      ?.ruleContributions.find((r) => r.ruleId === 'freshness')
    const staleRule = ranked
      .find((r) => r.opportunityId === 'stale')
      ?.ruleContributions.find((r) => r.ruleId === 'freshness')
    expect(freshRule?.normalizedValue).toBeCloseTo(1.0, 2)
    expect(staleRule?.normalizedValue).toBeCloseTo(Math.exp(-1), 2)
  })

  it('決定性: 同じ入力からは常に同じ結果、同点は案件IDで安定ソートされる', () => {
    const a = opportunity({ id: 'a', publishedAt: NOW })
    const b = opportunity({ id: 'b', publishedAt: NOW })
    const first = rankOpportunities(participant(), [b, a], NOW)
    const second = rankOpportunities(participant(), [b, a], NOW)
    expect(first).toEqual(second)
    expect(first.map((r) => r.opportunityId)).toEqual(['a', 'b'])
  })

  it('結果に matchingRuleVersion が含まれる', () => {
    const ranked = rankOpportunities(participant(), [opportunity()], NOW)
    expect(ranked[0].matchingRuleVersion).toBe(MATCHING_RULE_VERSION)
    expect(MATCHING_RULE_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('推薦理由', () => {
  it('寄与上位のルールから最大2件の日本語理由が生成される', () => {
    const p = participant({
      interests: ['子ども支援'],
      region: '東京都',
      scaledScores: fullScores,
    })
    const opp = opportunity({
      id: 'opp',
      category: '子ども支援',
      location: '東京都新宿区',
      activityStyleTags: ['talk-with-new-people'],
    })
    const ranked = rankOpportunities(p, [opp], NOW)
    expect(ranked[0].reasons.length).toBeLessThanOrEqual(2)
    expect(ranked[0].reasons[0]).toContain('子ども支援')
  })

  it('性格適合が寄与した場合、タグに応じた傾向説明が理由になる', () => {
    const p = participant({ scaledScores: fullScores })
    const opp = opportunity({ id: 'opp', activityStyleTags: ['talk-with-new-people'] })
    const ranked = rankOpportunities(p, [opp], NOW)
    const personalityReason = ranked[0].reasons.find((r) => r.includes('外向'))
    expect(personalityReason).toBeDefined()
    // 断定・適性保証の表現を含まない
    expect(personalityReason).not.toMatch(/向いています/)
  })

  it('鮮度以外に寄与がない場合のみ鮮度が理由になる', () => {
    const ranked = rankOpportunities(participant(), [opportunity({ publishedAt: NOW })], NOW)
    expect(ranked[0].reasons).toEqual(['最近公開された募集です'])
  })
})

import type { DomainScores } from '@/lib/diagnosis-scale/types'
import { findActivityStyleTag } from './activity-style-tags'

/**
 * ルールベースのマッチングエンジン（純粋関数）
 *
 * - ハード条件（参加可能性）とランキング（相性の並び順）を分離する
 * - 性格スコアはハード条件に使用しない。性格だけで案件を除外しない
 * - 重みは恣意的な初期値であり、「学習済み」「高精度」ではない。
 *   成果イベント（推薦ログ・応募・完了・評価）の蓄積後に再調整する
 */
export const MATCHING_RULE_VERSION = '1.0.0'

/** マッチングに使う参加者特徴。診断スコアは複数ある特徴の一つ */
export interface ParticipantFeatures {
  interests: string[]
  region: string | null
  /** 希望曜日（例: ['土', '日']） */
  availabilityWeekdays: string[]
  preferredParticipationMode: 'online' | 'offline' | null
  /** 診断の表示用スコア。未診断なら null（除外はされない） */
  scaledScores: DomainScores | null
  ageYears: number | null
}

export interface OpportunityFeatures {
  id: string
  category: string | null
  location: string | null
  organizationActivityAreas: string[]
  participationMode: 'online' | 'offline' | 'hybrid' | null
  startDate: Date | null
  endDate: Date | null
  publishedAt: Date | null
  capacity: number | null
  currentApplicants: number
  activityStyleTags: string[]
  minAge: number | null
  maxAge: number | null
}

export type ExclusionReason = 'ended' | 'capacity_full' | 'age_requirement'

export interface EligibilityResult {
  eligible: OpportunityFeatures[]
  excluded: Array<{ id: string; reason: ExclusionReason }>
}

export type RuleId =
  | 'interest'
  | 'region'
  | 'schedule'
  | 'participationMode'
  | 'personality'
  | 'freshness'

export interface RuleContribution {
  ruleId: RuleId
  /** ルールの正規化値 (0〜1) */
  normalizedValue: number
  weight: number
  /** normalizedValue × weight */
  weightedValue: number
}

export interface RankedOpportunity {
  opportunityId: string
  /** 0〜1。適用可能なルールの重み付き平均 */
  totalScore: number
  ruleContributions: RuleContribution[]
  /** 寄与上位のルールから生成した日本語の推薦理由（最大2件） */
  reasons: string[]
  matchingRuleVersion: string
}

/** ルール定義順 = 同点時の理由の優先順 */
const RULE_ORDER: RuleId[] = [
  'interest',
  'region',
  'schedule',
  'participationMode',
  'personality',
  'freshness',
]

const RULE_WEIGHTS: Record<RuleId, number> = {
  interest: 0.35,
  region: 0.15,
  schedule: 0.15,
  participationMode: 0.1,
  personality: 0.15,
  freshness: 0.1,
}

/** 鮮度減衰の時定数（日） */
const FRESHNESS_DECAY_DAYS = 30

/** 性格適合の方向判定閾値（scaled score） */
const PERSONALITY_HIGH_THRESHOLD = 60
const PERSONALITY_LOW_THRESHOLD = 40

const MS_PER_DAY = 24 * 60 * 60 * 1000
const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const WEEKDAY_LABELS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const

/** JST での暦日番号（日単位） */
function jstDayNumber(date: Date): number {
  return Math.floor((date.getTime() + JST_OFFSET_MS) / MS_PER_DAY)
}

/** JST での曜日ラベル */
function jstWeekday(date: Date): string {
  const dayIndex = Math.floor((date.getTime() + JST_OFFSET_MS) / MS_PER_DAY) % 7
  // 1970-01-01 は木曜日 (index 4)
  return WEEKDAY_LABELS_JA[(dayIndex + 4) % 7]
}

/**
 * ハード条件フィルタ。参加が不可能な案件のみを除外する。
 * 性格スコアは判定に使用しない。
 */
export function filterEligibleOpportunities(
  participant: ParticipantFeatures,
  opportunities: OpportunityFeatures[],
  now: Date
): EligibilityResult {
  const eligible: OpportunityFeatures[] = []
  const excluded: Array<{ id: string; reason: ExclusionReason }> = []
  const today = jstDayNumber(now)

  for (const opp of opportunities) {
    const lastDay = opp.endDate ?? opp.startDate
    if (lastDay !== null && jstDayNumber(lastDay) < today) {
      excluded.push({ id: opp.id, reason: 'ended' })
      continue
    }
    if (opp.capacity !== null && opp.currentApplicants >= opp.capacity) {
      excluded.push({ id: opp.id, reason: 'capacity_full' })
      continue
    }
    if (participant.ageYears !== null) {
      const tooYoung = opp.minAge !== null && participant.ageYears < opp.minAge
      const tooOld = opp.maxAge !== null && participant.ageYears > opp.maxAge
      if (tooYoung || tooOld) {
        excluded.push({ id: opp.id, reason: 'age_requirement' })
        continue
      }
    }
    eligible.push(opp)
  }

  return { eligible, excluded }
}

interface RuleEvaluation {
  /** 特徴の欠損時は false（重みを除外して再正規化する） */
  applicable: boolean
  value: number
  reason: string | null
}

function evaluateInterest(
  participant: ParticipantFeatures,
  opp: OpportunityFeatures
): RuleEvaluation {
  if (participant.interests.length === 0 || !opp.category) {
    return { applicable: false, value: 0, reason: null }
  }
  const matched = participant.interests.includes(opp.category)
  return {
    applicable: true,
    value: matched ? 1 : 0,
    reason: matched ? `興味分野「${opp.category}」と一致しています` : null,
  }
}

function evaluateRegion(
  participant: ParticipantFeatures,
  opp: OpportunityFeatures
): RuleEvaluation {
  if (opp.participationMode === 'online') {
    return { applicable: true, value: 1, reason: 'オンラインで参加できます' }
  }
  const hasOpportunityArea = Boolean(opp.location) || opp.organizationActivityAreas.length > 0
  if (!participant.region || !hasOpportunityArea) {
    return { applicable: false, value: 0, reason: null }
  }
  const region = participant.region
  const matched =
    (opp.location?.includes(region) ?? false) ||
    opp.organizationActivityAreas.some((area) => area.includes(region))
  return {
    applicable: true,
    value: matched ? 1 : 0,
    reason: matched ? `活動地域があなたの地域（${region}）に対応しています` : null,
  }
}

function evaluateSchedule(
  participant: ParticipantFeatures,
  opp: OpportunityFeatures
): RuleEvaluation {
  const start = opp.startDate ?? opp.endDate
  const end = opp.endDate ?? opp.startDate
  if (participant.availabilityWeekdays.length === 0 || start === null || end === null) {
    return { applicable: false, value: 0, reason: null }
  }
  const spanDays = jstDayNumber(end) - jstDayNumber(start) + 1
  let opportunityWeekdays: Set<string>
  if (spanDays >= 7) {
    opportunityWeekdays = new Set(WEEKDAY_LABELS_JA)
  } else {
    opportunityWeekdays = new Set<string>()
    for (let i = 0; i < spanDays; i++) {
      opportunityWeekdays.add(jstWeekday(new Date(start.getTime() + i * MS_PER_DAY)))
    }
  }
  const matched = participant.availabilityWeekdays.some((weekday) =>
    opportunityWeekdays.has(weekday)
  )
  return {
    applicable: true,
    value: matched ? 1 : 0,
    reason: matched ? '希望する曜日に活動できる日程です' : null,
  }
}

function evaluateParticipationMode(
  participant: ParticipantFeatures,
  opp: OpportunityFeatures
): RuleEvaluation {
  if (!participant.preferredParticipationMode || !opp.participationMode) {
    return { applicable: false, value: 0, reason: null }
  }
  if (opp.participationMode === participant.preferredParticipationMode) {
    return { applicable: true, value: 1, reason: '希望の参加形態と一致しています' }
  }
  if (opp.participationMode === 'hybrid') {
    return { applicable: true, value: 0.5, reason: '希望の参加形態を選べる案件です' }
  }
  return { applicable: true, value: 0, reason: null }
}

function evaluatePersonality(
  participant: ParticipantFeatures,
  opp: OpportunityFeatures
): RuleEvaluation {
  const tags = opp.activityStyleTags
    .map((id) => findActivityStyleTag(id))
    .filter((tag): tag is NonNullable<typeof tag> => tag !== undefined)
  if (!participant.scaledScores || tags.length === 0) {
    return { applicable: false, value: 0, reason: null }
  }
  const scores = participant.scaledScores
  const matchedTags = tags.filter((tag) =>
    tag.direction === 'high'
      ? scores[tag.domain] >= PERSONALITY_HIGH_THRESHOLD
      : scores[tag.domain] <= PERSONALITY_LOW_THRESHOLD
  )
  // 加点のみ。逆方向でも減点しない
  return {
    applicable: true,
    value: matchedTags.length / tags.length,
    reason: matchedTags[0]?.reasonText ?? null,
  }
}

function evaluateFreshness(opp: OpportunityFeatures, now: Date): RuleEvaluation {
  if (opp.publishedAt === null) {
    return { applicable: false, value: 0, reason: null }
  }
  const ageDays = Math.max(0, (now.getTime() - opp.publishedAt.getTime()) / MS_PER_DAY)
  return {
    applicable: true,
    value: Math.exp(-ageDays / FRESHNESS_DECAY_DAYS),
    reason: '最近公開された募集です',
  }
}

/**
 * ハード条件を通過した案件をルールベースで順位付けする。
 * 欠損した特徴の重みは除外して再正規化する。
 */
export function rankOpportunities(
  participant: ParticipantFeatures,
  opportunities: OpportunityFeatures[],
  now: Date
): RankedOpportunity[] {
  return opportunities
    .map((opp) => rankOne(participant, opp, now))
    .sort((a, b) => {
      if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore
      return a.opportunityId.localeCompare(b.opportunityId)
    })
}

function rankOne(
  participant: ParticipantFeatures,
  opp: OpportunityFeatures,
  now: Date
): RankedOpportunity {
  const evaluations: Record<RuleId, RuleEvaluation> = {
    interest: evaluateInterest(participant, opp),
    region: evaluateRegion(participant, opp),
    schedule: evaluateSchedule(participant, opp),
    participationMode: evaluateParticipationMode(participant, opp),
    personality: evaluatePersonality(participant, opp),
    freshness: evaluateFreshness(opp, now),
  }

  const contributions: RuleContribution[] = []
  let weightedSum = 0
  let applicableWeightSum = 0
  for (const ruleId of RULE_ORDER) {
    const evaluation = evaluations[ruleId]
    if (!evaluation.applicable) continue
    const weight = RULE_WEIGHTS[ruleId]
    const weightedValue = evaluation.value * weight
    contributions.push({
      ruleId,
      normalizedValue: evaluation.value,
      weight,
      weightedValue,
    })
    weightedSum += weightedValue
    applicableWeightSum += weight
  }

  const totalScore = applicableWeightSum > 0 ? weightedSum / applicableWeightSum : 0

  // 推薦理由: 鮮度以外で寄与のあったルール上位2件。なければ鮮度のみ
  const reasonCandidates = RULE_ORDER.filter(
    (ruleId) =>
      ruleId !== 'freshness' &&
      evaluations[ruleId].applicable &&
      evaluations[ruleId].value > 0 &&
      evaluations[ruleId].reason !== null
  ).sort(
    (a, b) =>
      evaluations[b].value * RULE_WEIGHTS[b] - evaluations[a].value * RULE_WEIGHTS[a]
  )
  let reasons = reasonCandidates
    .slice(0, 2)
    .map((ruleId) => evaluations[ruleId].reason)
    .filter((reason): reason is string => reason !== null)
  if (reasons.length === 0 && evaluations.freshness.applicable && evaluations.freshness.value > 0) {
    reasons = ['最近公開された募集です']
  }

  return {
    opportunityId: opp.id,
    totalScore,
    ruleContributions: contributions,
    reasons,
    matchingRuleVersion: MATCHING_RULE_VERSION,
  }
}

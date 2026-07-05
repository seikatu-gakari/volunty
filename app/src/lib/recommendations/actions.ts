"use server"

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { isDomainScores } from "@/lib/diagnosis-scale/scoring"
import {
  MATCHING_RULE_VERSION,
  filterEligibleOpportunities,
  rankOpportunities,
} from "./engine"
import type { OpportunityFeatures, ParticipantFeatures } from "./engine"
import { toActivityStyleTagIds } from "./activity-style-tags"
import type {
  OpportunityRecommendation,
  RecommendationFilters,
  RecommendationResult,
} from "./types"

function normalizeFilterValue(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function matchesCategory(category: string | null, filter: string): boolean {
  return category === filter
}

function matchesRegion(
  location: string | null,
  activityAreas: unknown,
  region: string
): boolean {
  const locationMatched = location?.includes(region) ?? false
  const areaMatched = toStringArray(activityAreas).some((area) =>
    area.includes(region)
  )
  return locationMatched || areaMatched
}

function normalizeParticipationMode(
  value?: string
): RecommendationFilters["participationMode"] | null {
  return value === "online" || value === "offline" ? value : null
}

function matchesParticipationMode(
  participationMode: string | null,
  filter: NonNullable<RecommendationFilters["participationMode"]>
): boolean {
  // hybrid 案件は online/offline 両方のフィルタに合致する
  if (participationMode === "hybrid") return true
  return participationMode === filter
}

/** 誕生日から満年齢を計算する */
function toAgeYears(birthday: Date | null, now: Date): number | null {
  if (!birthday) return null
  const age =
    now.getFullYear() -
    birthday.getFullYear() -
    (now.getMonth() < birthday.getMonth() ||
    (now.getMonth() === birthday.getMonth() && now.getDate() < birthday.getDate())
      ? 1
      : 0)
  return age >= 0 ? age : null
}

/** availability JSON から希望曜日を取り出す */
function toAvailabilityWeekdays(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  return toStringArray((value as Record<string, unknown>).weekdays)
}

/**
 * 現在のログインユーザーのプロフィール・診断結果をもとに、
 * ルールベースのランキング順のおすすめ案件一覧を返す。
 *
 * - ハード条件（終了・定員・年齢）で参加不可能な案件のみ除外する
 * - 性格は複数あるランキング要素の一つ。未診断でも推薦は返る
 * - 表示した推薦は t_recommendation_log に記録し、将来の精度評価に使う
 */
export async function fetchRecommendations(
  filters?: RecommendationFilters
): Promise<RecommendationResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { recommendations: [], hasCompletedDiagnosis: false }
    }

    const participant = await prisma.participantProfile.findUnique({
      where: { userId: user.id },
      select: {
        interests: true,
        region: true,
        availability: true,
        birthday: true,
        latestDiagnosisResult: {
          select: { id: true, scaledScores: true },
        },
      },
    })

    if (!participant) {
      return { recommendations: [], hasCompletedDiagnosis: false }
    }

    const latestDiagnosis = participant.latestDiagnosisResult
    const scaledScores =
      latestDiagnosis && isDomainScores(latestDiagnosis.scaledScores)
        ? latestDiagnosis.scaledScores
        : null
    const hasCompletedDiagnosis = scaledScores !== null

    const now = new Date()
    const participantFeatures: ParticipantFeatures = {
      interests: toStringArray(participant.interests),
      region: participant.region || null,
      availabilityWeekdays: toAvailabilityWeekdays(participant.availability),
      preferredParticipationMode: null,
      scaledScores,
      ageYears: toAgeYears(participant.birthday, now),
    }

    const categoryFilter = normalizeFilterValue(filters?.category)
    const regionFilter = normalizeFilterValue(filters?.region)
    const participationModeFilter = normalizeParticipationMode(
      filters?.participationMode
    )

    // 公開中の案件を団体名とともに取得
    const opportunities = await prisma.opportunity.findMany({
      where: { status: "published" },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        category: true,
        participationMode: true,
        activityStyleTags: true,
        startDate: true,
        endDate: true,
        publishedAt: true,
        capacity: true,
        currentApplicants: true,
        minAge: true,
        maxAge: true,
        organization: {
          select: {
            organizationName: true,
            activityAreas: true,
          },
        },
      },
    })

    // ユーザー操作によるフィルタ（ハード条件とは別）
    const filteredOpportunities = opportunities.filter((opp) => {
      if (categoryFilter && !matchesCategory(opp.category, categoryFilter)) {
        return false
      }
      if (
        regionFilter &&
        !matchesRegion(opp.location, opp.organization.activityAreas, regionFilter)
      ) {
        return false
      }
      if (
        participationModeFilter &&
        !matchesParticipationMode(opp.participationMode, participationModeFilter)
      ) {
        return false
      }
      return true
    })

    if (filteredOpportunities.length === 0) {
      return { recommendations: [], hasCompletedDiagnosis }
    }

    const featureById = new Map<
      string,
      (typeof filteredOpportunities)[number]
    >(filteredOpportunities.map((opp) => [opp.id, opp]))

    const opportunityFeatures: OpportunityFeatures[] = filteredOpportunities.map(
      (opp) => ({
        id: opp.id,
        category: opp.category,
        location: opp.location,
        organizationActivityAreas: toStringArray(opp.organization.activityAreas),
        participationMode: opp.participationMode,
        startDate: opp.startDate,
        endDate: opp.endDate,
        publishedAt: opp.publishedAt,
        capacity: opp.capacity,
        currentApplicants: opp.currentApplicants,
        activityStyleTags: toActivityStyleTagIds(opp.activityStyleTags),
        minAge: opp.minAge,
        maxAge: opp.maxAge,
      })
    )

    // ハード条件（参加可能性）→ ランキング（相性）の順に適用
    const { eligible } = filterEligibleOpportunities(
      participantFeatures,
      opportunityFeatures,
      now
    )
    const ranked = rankOpportunities(participantFeatures, eligible, now)

    // 推薦の生成・表示を記録（失敗しても推薦自体は返す）
    const logIdByOpportunity = new Map<string, string>()
    try {
      const logs = await prisma.$transaction(
        ranked.map((item, index) =>
          prisma.recommendationLog.create({
            data: {
              userId: user.id,
              opportunityId: item.opportunityId,
              rank: index + 1,
              totalScore: item.totalScore,
              ruleContributions:
                item.ruleContributions as unknown as Prisma.InputJsonValue,
              reasons: item.reasons,
              matchingRuleVersion: MATCHING_RULE_VERSION,
              diagnosisResultId: latestDiagnosis?.id ?? null,
            },
            select: { id: true, opportunityId: true },
          })
        )
      )
      for (const log of logs) {
        logIdByOpportunity.set(log.opportunityId, log.id)
      }
    } catch (err) {
      console.error("[fetchRecommendations] 推薦ログの記録に失敗:", err)
    }

    const recommendations: OpportunityRecommendation[] = ranked.map((item) => {
      const opp = featureById.get(item.opportunityId)
      return {
        id: item.opportunityId,
        title: opp?.title ?? "",
        description: opp?.description ?? null,
        organizationName: opp?.organization.organizationName ?? "",
        reasons: item.reasons,
        recommendationLogId: logIdByOpportunity.get(item.opportunityId) ?? null,
      }
    })

    return { recommendations, hasCompletedDiagnosis }
  } catch (err) {
    console.error("[fetchRecommendations] 予期しないエラー:", err)
    return { recommendations: [], hasCompletedDiagnosis: false }
  }
}

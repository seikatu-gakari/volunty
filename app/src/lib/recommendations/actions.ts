"use server"

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import type { BIG5Scores } from "@/lib/personality/types"
import type {
  OpportunityRecommendation,
  RecommendationFilters,
  RecommendationResult,
} from "./types"
import { calculateMatchScore } from "./matching"

const BIG5_TRAIT_KEYS = [
  "extraversion",
  "agreeableness",
  "conscientiousness",
  "neuroticism",
  "openness",
] as const

/**
 * 未知の値が BIG5Scores 型かどうかを実行時に検証するタイプガード
 */
function isBIG5Scores(value: unknown): value is BIG5Scores {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return BIG5_TRAIT_KEYS.every((t) => typeof obj[t] === "number")
}

/**
 * データベースの JSONB 値から有効な BIG5 特性キーのみを抽出する。
 * 不明なキーや数値以外の値は除外する。
 */
function toPartialBIG5Scores(
  value: Record<string, unknown>
): Partial<BIG5Scores> {
  const result: Partial<BIG5Scores> = {}
  for (const trait of BIG5_TRAIT_KEYS) {
    const v = value[trait]
    if (typeof v === "number") result[trait] = v
  }
  return result
}

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

/**
 * 現在のログインユーザーのBIG5診断スコアをもとに、
 * マッチングスコア順にソートされたおすすめ案件一覧を返す。
 *
 * - 未ログイン時: recommendations=[], hasCompletedDiagnosis=false
 * - 診断未実施時: recommendations=[], hasCompletedDiagnosis=false
 * - 正常時: マッチングスコア降順の案件一覧
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

    // 参加者の診断スコアを取得
    const participant = await prisma.participantProfile.findUnique({
      where: { userId: user.id },
      select: { diagnosisScores: true },
    })

    const rawScores = participant?.diagnosisScores
    if (!isBIG5Scores(rawScores)) {
      return { recommendations: [], hasCompletedDiagnosis: false }
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
        requirementTraits: true,
        organization: {
          select: {
            organizationName: true,
            activityAreas: true,
          },
        },
      },
    })

    if (opportunities.length === 0) {
      return { recommendations: [], hasCompletedDiagnosis: true }
    }

    const filteredOpportunities = opportunities.filter((opp) => {
      if (categoryFilter && !matchesCategory(opp.category, categoryFilter)) {
        return false
      }

      if (
        regionFilter &&
        !matchesRegion(
          opp.location,
          opp.organization.activityAreas,
          regionFilter
        )
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
      return { recommendations: [], hasCompletedDiagnosis: true }
    }

    // マッチングスコアを計算してソート
    const recommendations: OpportunityRecommendation[] = filteredOpportunities
      .map((opp) => ({
        id: opp.id,
        title: opp.title,
        description: opp.description,
        organizationName: opp.organization.organizationName,
        matchScore: calculateMatchScore(
          rawScores,
          toPartialBIG5Scores(
            (opp.requirementTraits as Record<string, unknown>) ?? {}
          )
        ),
      }))
      .sort((a, b) => b.matchScore - a.matchScore)

    return { recommendations, hasCompletedDiagnosis: true }
  } catch (err) {
    console.error("[fetchRecommendations] 予期しないエラー:", err)
    return { recommendations: [], hasCompletedDiagnosis: false }
  }
}

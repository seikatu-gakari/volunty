"use server"

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import type { BIG5Scores } from "@/lib/personality/types"
import type { OpportunityRecommendation, RecommendationResult } from "./types"
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

/**
 * 現在のログインユーザーのBIG5診断スコアをもとに、
 * マッチングスコア順にソートされたおすすめ案件一覧を返す。
 *
 * - 未ログイン時: recommendations=[], hasCompletedDiagnosis=false
 * - 診断未実施時: recommendations=[], hasCompletedDiagnosis=false
 * - 正常時: マッチングスコア降順の案件一覧
 */
export async function fetchRecommendations(): Promise<RecommendationResult> {
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

    // 公開中の案件を団体名とともに取得
    const { data: opportunities, error } = await supabase
      .from("opportunities")
      .select(
        `
        id,
        title,
        description,
        required_traits,
        organizations ( name )
      `
      )
      .eq("status", "open")

    if (error || !opportunities || opportunities.length === 0) {
      return { recommendations: [], hasCompletedDiagnosis: true }
    }

    type OpportunityRow = {
      id: string
      title: string
      description: string | null
      required_traits: Record<string, unknown> | null
      organizations: { name: string }[] | { name: string } | null
    }

    // マッチングスコアを計算してソート
    const recommendations: OpportunityRecommendation[] = (
      opportunities as unknown as OpportunityRow[]
    )
      .map((opp) => {
        // Supabaseのリレーションは配列または単一オブジェクトで返る場合がある
        const org = Array.isArray(opp.organizations)
          ? opp.organizations[0]
          : opp.organizations
        return {
          id: opp.id,
          title: opp.title,
          description: opp.description,
          organizationName: org?.name ?? "不明",
          matchScore: calculateMatchScore(
            rawScores,
            toPartialBIG5Scores(opp.required_traits ?? {})
          ),
        }
      })
      .sort((a, b) => b.matchScore - a.matchScore)

    return { recommendations, hasCompletedDiagnosis: true }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[fetchRecommendations] 予期しないエラー:", err)
    }
    return { recommendations: [], hasCompletedDiagnosis: false }
  }
}

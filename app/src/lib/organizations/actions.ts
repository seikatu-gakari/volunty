"use server";

import { createClient } from "@/lib/supabase/server";
import type { BIG5Scores } from "@/lib/personality/types";
import { calculateMatchScore } from "@/lib/recommendations/matching";
import type {
  OrganizationDetailResult,
  OrganizationDetail,
  OrganizationOpportunity,
} from "./types";

const BIG5_TRAIT_KEYS = [
  "extraversion",
  "agreeableness",
  "conscientiousness",
  "neuroticism",
  "openness",
] as const;

/**
 * 未知の値が BIG5Scores 型かどうかを実行時に検証するタイプガード
 */
function isBIG5Scores(value: unknown): value is BIG5Scores {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return BIG5_TRAIT_KEYS.every((t) => typeof obj[t] === "number");
}

/**
 * データベースの JSONB 値から有効な BIG5 特性キーのみを抽出する。
 */
function toPartialBIG5Scores(
  value: Record<string, unknown>
): Partial<BIG5Scores> {
  const result: Partial<BIG5Scores> = {};
  for (const trait of BIG5_TRAIT_KEYS) {
    const v = value[trait];
    if (typeof v === "number") result[trait] = v;
  }
  return result;
}

/**
 * 団体詳細データを取得する
 *
 * - organizations テーブルから団体情報を取得
 * - opportunities（status = 'open'）を合わせて取得
 * - ログインユーザーの診断スコアがあれば相性スコアも算出
 */
export async function fetchOrganizationDetail(
  organizationId: string
): Promise<OrganizationDetailResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        organization: null,
        opportunities: [],
        isParticipant: false,
      };
    }

    // 団体データを取得
    const { data: orgData, error: orgError } = await supabase
      .from("m_organization_profile")
      .select("id, organization_name, description")
      .eq("id", organizationId)
      .single();

    if (orgError || !orgData) {
      return {
        organization: null,
        opportunities: [],
        isParticipant: false,
      };
    }

    const organization: OrganizationDetail = {
      id: orgData.id as string,
      name: (orgData as unknown as { organization_name: string }).organization_name,
      description: (orgData.description as string) ?? null,
    };

    // 参加者プロフィールを取得（マッチングスコア計算用）
    let participantScores: BIG5Scores | null = null;
    let isParticipant = false;

    const { data: participant } = await supabase
      .from("m_participant_profile")
      .select("diagnosis_scores")
      .eq("user_id", user.id)
      .single();

    if (participant) {
      isParticipant = true;
      const rawScores = participant.diagnosis_scores;
      if (isBIG5Scores(rawScores)) {
        participantScores = rawScores;
      }
    }

    // 公開中の募集案件を取得
    const { data: oppData } = await supabase
      .from("m_opportunity")
      .select("id, title, description, requirement_traits")
      .eq("organization_id", organizationId)
      .eq("status", "published");

    const opportunities: OrganizationOpportunity[] = (oppData ?? []).map(
      (opp) => {
        let matchScore: number | null = null;
        const oppRequirementTraits = (opp as unknown as { requirement_traits: Record<string, unknown> | null }).requirement_traits;
        if (participantScores && oppRequirementTraits) {
          matchScore = calculateMatchScore(
            participantScores,
            toPartialBIG5Scores(oppRequirementTraits)
          );
        }
        return {
          id: opp.id as string,
          title: opp.title as string,
          description: (opp.description as string) ?? null,
          required_traits:
            (oppRequirementTraits as Record<string, number>) ?? null,
          matchScore,
        };
      }
    );

    return {
      organization,
      opportunities,
      isParticipant,
    };
  } catch (err) {
    console.error("[fetchOrganizationDetail] 予期しないエラー:", err);
    return {
      organization: null,
      opportunities: [],
      isParticipant: false,
    };
  }
}

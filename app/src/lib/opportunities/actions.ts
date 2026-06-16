"use server";

import { createClient } from "@/lib/supabase/server";
import type { BIG5Scores } from "@/lib/personality/types";
import { calculateMatchScore } from "@/lib/recommendations/matching";
import type {
  OpportunityDetailResult,
  OpportunityDetail,
  ExistingApplication,
  ApplyResult,
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
 * 募集案件詳細データを取得する
 *
 * - opportunities + organizations を JOIN して案件情報を取得
 * - 参加者の場合、マッチングスコアを計算
 * - 既存の応募があれば応募情報を含める
 */
export async function fetchOpportunityDetail(
  opportunityId: string
): Promise<OpportunityDetailResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        opportunity: null,
        matchScore: null,
        existingApplication: null,
        isParticipant: false,
      };
    }

    // 案件データを取得（m_organization_profile JOIN）
    const { data: oppData, error: oppError } = await supabase
      .from("m_opportunity")
      .select(
        `
        id,
        title,
        description,
        requirement_traits,
        status,
        created_at,
        m_organization_profile (
          id,
          organization_name,
          description
        )
      `
      )
      .eq("id", opportunityId)
      .single();

    if (oppError || !oppData) {
      return {
        opportunity: null,
        matchScore: null,
        existingApplication: null,
        isParticipant: false,
      };
    }

    // Supabase の JOIN 結果を型変換
    const org = oppData.m_organization_profile as unknown as {
      id: string;
      organization_name: string;
      description: string | null;
    } | null;

    const opportunity: OpportunityDetail = {
      id: oppData.id as string,
      title: oppData.title as string,
      description: (oppData.description as string) ?? null,
      required_traits:
        (oppData.requirement_traits as Record<string, number>) ?? null,
      status: oppData.status as OpportunityDetail["status"],
      organization: {
        id: org?.id ?? "",
        name: org?.organization_name ?? "",
        description: org?.description ?? null,
      },
      created_at: oppData.created_at as string,
    };

    // 参加者プロフィールを取得（マッチングスコア計算用）
    let matchScore: number | null = null;
    let isParticipant = false;

    const { data: participant } = await supabase
      .from("m_participant_profile")
      .select("diagnosis_scores")
      .eq("user_id", user.id)
      .single();

    if (participant) {
      isParticipant = true;
      const rawScores = participant.diagnosis_scores;
      if (isBIG5Scores(rawScores) && opportunity.required_traits) {
        matchScore = calculateMatchScore(
          rawScores,
          toPartialBIG5Scores(
            opportunity.required_traits as Record<string, unknown>
          )
        );
      }
    }

    // 既存の応募を確認
    let existingApplication: ExistingApplication | null = null;

    const { data: appData } = await supabase
      .from("t_matching_candidate")
      .select("id, status, message, applied_at, status_changed_at")
      .eq("opportunity_id", opportunityId)
      .eq("participant_id", user.id)
      .single();

    if (appData) {
      existingApplication = {
        id: appData.id as string,
        status: mapMatchingStatus(appData.status as string),
        message: (appData.message as string) ?? null,
        created_at: (appData.applied_at as string) ?? "",
        completed_at:
          appData.status === "completed"
            ? (appData.status_changed_at as string)
            : null,
      };
    }

    return {
      opportunity,
      matchScore,
      existingApplication,
      isParticipant,
    };
  } catch (err) {
    console.error("[fetchOpportunityDetail] 予期しないエラー:", err);
    return {
      opportunity: null,
      matchScore: null,
      existingApplication: null,
      isParticipant: false,
    };
  }
}

/**
 * DB の MatchingStatus を UI 表示用の ApplicationStatus にマッピングする
 */
function mapMatchingStatus(dbStatus: string): ExistingApplication["status"] {
  if (dbStatus === "applied" || dbStatus === "queued") return "pending";
  if (dbStatus === "accepted") return "approved";
  if (dbStatus === "completed") return "completed";
  if (dbStatus === "declined") return "rejected";
  return "pending";
}

/**
 * 募集案件に応募する
 *
 * - t_matching_candidate テーブルに INSERT（status: 'applied'）
 * - 重複応募チェック: 同一 participant_id + opportunity_id の既存レコードがあればエラー
 */
export async function applyToOpportunity(
  opportunityId: string,
  message: string
): Promise<ApplyResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "ログインが必要です" };
    }

    // 参加者であることを確認（診断スコアも取得）
    const { data: participant } = await supabase
      .from("m_participant_profile")
      .select("id, diagnosis_scores")
      .eq("user_id", user.id)
      .single();

    if (!participant) {
      return { success: false, error: "参加者登録が必要です" };
    }

    // 案件の存在とステータスを確認（requirement_traits も取得）
    const { data: opportunity } = await supabase
      .from("m_opportunity")
      .select("id, status, requirement_traits")
      .eq("id", opportunityId)
      .single();

    if (!opportunity) {
      return { success: false, error: "案件が見つかりません" };
    }

    if (opportunity.status !== "published") {
      return { success: false, error: "この案件は募集を終了しています" };
    }

    // 重複応募チェック
    const { data: existingApp } = await supabase
      .from("t_matching_candidate")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .eq("participant_id", user.id)
      .single();

    if (existingApp) {
      return { success: false, error: "この案件にはすでに応募済みです" };
    }

    // マッチングスコアを計算
    const diagScores = participant.diagnosis_scores;
    const reqTraits = opportunity.requirement_traits as Record<string, unknown> | null;
    let matchScore = 50; // 診断スコアまたは要件特性がない場合のデフォルト
    if (isBIG5Scores(diagScores) && reqTraits) {
      matchScore = calculateMatchScore(diagScores, toPartialBIG5Scores(reqTraits));
    }

    // 応募を作成
    // Supabase REST API では Prisma の @updatedAt は機能しないため、
    // updated_at / created_at を明示的に設定する
    const now = new Date().toISOString();
    const { error: insertError } = await supabase
      .from("t_matching_candidate")
      .insert({
        opportunity_id: opportunityId,
        participant_id: user.id,
        message: message || null,
        status: "applied",
        match_score: matchScore,
        applied_at: now,
        status_changed_at: now,
        created_at: now,
        updated_at: now,
      });

    if (insertError) {
      console.error("[applyToOpportunity] INSERT エラー:", insertError);
      return { success: false, error: "応募の送信に失敗しました" };
    }

    return { success: true };
  } catch (err) {
    console.error("[applyToOpportunity] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

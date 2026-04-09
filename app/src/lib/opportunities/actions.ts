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

    // 案件データを取得（organizations JOIN）
    const { data: oppData, error: oppError } = await supabase
      .from("opportunities")
      .select(
        `
        id,
        title,
        description,
        required_traits,
        status,
        created_at,
        organizations (
          name,
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
    const org = oppData.organizations as unknown as {
      name: string;
      description: string | null;
    } | null;

    const opportunity: OpportunityDetail = {
      id: oppData.id as string,
      title: oppData.title as string,
      description: (oppData.description as string) ?? null,
      required_traits:
        (oppData.required_traits as Record<string, number>) ?? null,
      status: oppData.status as OpportunityDetail["status"],
      organization: {
        name: org?.name ?? "",
        description: org?.description ?? null,
      },
      created_at: oppData.created_at as string,
    };

    // 参加者プロフィールを取得（マッチングスコア計算用）
    let matchScore: number | null = null;
    let isParticipant = false;

    const { data: participant } = await supabase
      .from("participants")
      .select("diagnosis_scores")
      .eq("id", user.id)
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
      .from("applications")
      .select("id, status, message, created_at")
      .eq("opportunity_id", opportunityId)
      .eq("participant_id", user.id)
      .single();

    if (appData) {
      existingApplication = {
        id: appData.id as string,
        status: appData.status as ExistingApplication["status"],
        message: (appData.message as string) ?? null,
        created_at: appData.created_at as string,
      };
    }

    return {
      opportunity,
      matchScore,
      existingApplication,
      isParticipant,
    };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[fetchOpportunityDetail] 予期しないエラー:", err);
    }
    return {
      opportunity: null,
      matchScore: null,
      existingApplication: null,
      isParticipant: false,
    };
  }
}

/**
 * 募集案件に応募する
 *
 * - applications テーブルに INSERT（status: 'pending'）
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

    // 参加者であることを確認
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!participant) {
      return { success: false, error: "参加者登録が必要です" };
    }

    // 案件の存在とステータスを確認
    const { data: opportunity } = await supabase
      .from("opportunities")
      .select("id, status")
      .eq("id", opportunityId)
      .single();

    if (!opportunity) {
      return { success: false, error: "案件が見つかりません" };
    }

    if (opportunity.status !== "open") {
      return { success: false, error: "この案件は募集を終了しています" };
    }

    // 重複応募チェック
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id")
      .eq("opportunity_id", opportunityId)
      .eq("participant_id", user.id)
      .single();

    if (existingApp) {
      return { success: false, error: "この案件にはすでに応募済みです" };
    }

    // 応募を作成
    const { error: insertError } = await supabase
      .from("applications")
      .insert({
        opportunity_id: opportunityId,
        participant_id: user.id,
        message: message || null,
        status: "pending",
      });

    if (insertError) {
      return { success: false, error: "応募の送信に失敗しました" };
    }

    return { success: true };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[applyToOpportunity] 予期しないエラー:", err);
    }
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

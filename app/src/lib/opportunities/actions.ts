"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { ApplyResult } from "./types";

/**
 * 募集案件に応募する
 *
 * - t_matching_candidate テーブルに INSERT（status: 'applied'）
 * - 重複応募チェック: 同一 participant_id + opportunity_id の既存レコードがあればエラー
 * - どの推薦から応募に至ったかを recommendation_log_id で追跡する（任意）
 */
export async function applyToOpportunity(
  opportunityId: string,
  message: string,
  recommendationLogId?: string | null
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
      .from("m_participant_profile")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!participant) {
      return { success: false, error: "参加者登録が必要です" };
    }

    // 案件の存在とステータスを確認
    const { data: opportunity } = await supabase
      .from("m_opportunity")
      .select("id, status, published_at")
      .eq("id", opportunityId)
      .single();

    if (!opportunity) {
      return { success: false, error: "案件が見つかりません" };
    }

    const publishedAt = opportunity.published_at as string | null;
    if (
      opportunity.status !== "published" ||
      (publishedAt && new Date(publishedAt).getTime() > Date.now())
    ) {
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

    // 応募元の推薦ログが本人のものであることを確認（他人のログIDは無視する）
    let validatedLogId: string | null = null;
    if (recommendationLogId) {
      const log = await prisma.recommendationLog.findFirst({
        where: { id: recommendationLogId, userId: user.id, opportunityId },
        select: { id: true },
      });
      validatedLogId = log?.id ?? null;
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
        recommendation_log_id: validatedLogId,
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

"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { findActivityStyleTag, toActivityStyleTagIds } from "@/lib/recommendations/activity-style-tags";
import type {
  OpportunityDetailResult,
  OpportunityDetail,
  ExistingApplication,
  ApplyResult,
} from "./types";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** 閲覧イベントの流入元 */
export type OpportunityViewSource = "recommendation" | "search" | "direct";

/**
 * 募集案件詳細データを取得する
 *
 * - opportunities + organizations を JOIN して案件情報を取得
 * - 既存の応募があれば応募情報を含める
 * - 参加者の閲覧はエンゲージメントイベントとして記録する（マッチング精度の将来評価用）
 */
export async function fetchOpportunityDetail(
  opportunityId: string,
  viewSource: OpportunityViewSource = "direct"
): Promise<OpportunityDetailResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 案件データを取得（m_organization_profile JOIN）
    const { data: oppData, error: oppError } = await supabase
      .from("m_opportunity")
      .select(
        `
        id,
        title,
        description,
        activity_style_tags,
        required_qualifications,
        min_age,
        max_age,
        status,
        published_at,
        created_at,
        location,
        start_date,
        end_date,
        capacity,
        current_applicants,
        category,
        participation_mode,
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
        existingApplication: null,
        isParticipant: false,
      };
    }

    const publishedAt = oppData.published_at as string | null;
    if (
      oppData.status !== "published" ||
      (publishedAt && new Date(publishedAt).getTime() > Date.now())
    ) {
      return {
        opportunity: null,
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

    const activityStyleLabels = toActivityStyleTagIds(oppData.activity_style_tags)
      .map((tagId) => findActivityStyleTag(tagId)?.label)
      .filter((label): label is string => Boolean(label));

    const opportunity: OpportunityDetail = {
      id: oppData.id as string,
      title: oppData.title as string,
      description: (oppData.description as string) ?? null,
      activity_style_labels: activityStyleLabels,
      required_qualifications: toStringArray(oppData.required_qualifications),
      min_age: (oppData.min_age as number | null) ?? null,
      max_age: (oppData.max_age as number | null) ?? null,
      status: oppData.status as OpportunityDetail["status"],
      organization: {
        id: org?.id ?? "",
        name: org?.organization_name ?? "",
        description: org?.description ?? null,
      },
      created_at: oppData.created_at as string,
      location: (oppData.location as string | null) ?? null,
      start_date:
        ((oppData.start_date as string | null) ?? null)?.slice(0, 10) ?? null,
      end_date:
        ((oppData.end_date as string | null) ?? null)?.slice(0, 10) ?? null,
      capacity: (oppData.capacity as number | null) ?? null,
      current_applicants: (oppData.current_applicants as number | null) ?? 0,
      category: (oppData.category as string | null) ?? null,
      participation_mode:
        (oppData.participation_mode as OpportunityDetail["participation_mode"]) ??
        null,
    };

    // current_applicants は応募作成時に同期されないため、応募テーブルの実件数を使う。
    // 集計に失敗した場合のみ、案件テーブルの保持値へフォールバックする。
    try {
      const currentApplicants = await prisma.matchingCandidate.count({
        where: {
          opportunityId,
          status: { in: ["applied", "accepted", "completed"] },
        },
      });
      if (typeof currentApplicants === "number") {
        opportunity.current_applicants = currentApplicants;
      }
    } catch (err) {
      console.error("[fetchOpportunityDetail] 応募者数の集計に失敗:", err);
    }

    if (!user) {
      return {
        opportunity,
        existingApplication: null,
        isParticipant: false,
      };
    }

    // 参加者判定
    const { data: participant } = await supabase
      .from("m_participant_profile")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const isParticipant = Boolean(participant);

    // 閲覧イベントを記録（失敗しても表示は継続する）
    if (isParticipant) {
      try {
        await prisma.engagementEvent.create({
          data: {
            userId: user.id,
            opportunityId,
            event: "view",
            source: viewSource,
          },
        });
      } catch (err) {
        console.error("[fetchOpportunityDetail] 閲覧イベントの記録に失敗:", err);
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
      existingApplication,
      isParticipant,
    };
  } catch (err) {
    console.error("[fetchOpportunityDetail] 予期しないエラー:", err);
    return {
      opportunity: null,
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
  if (dbStatus === "declined" || dbStatus === "cancelled") return "rejected";
  return "pending";
}

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

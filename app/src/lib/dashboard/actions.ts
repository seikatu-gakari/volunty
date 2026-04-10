"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { BIG5Scores } from "@/lib/personality/types";
import { calculateMatchScore } from "@/lib/recommendations/matching";
import type {
  DashboardData,
  DashboardOpportunity,
  CreateOpportunityResult,
  Applicant,
  ApplicantsResult,
  UpdateApplicationStatusResult,
} from "./types";

/**
 * 団体ダッシュボード用：自団体の募集案件一覧を取得
 *
 * - opportunities テーブルから organization_id = 現在のユーザーID でフィルタ
 * - 各案件の応募者数（applications の COUNT）を含める
 * - 作成日の降順でソート
 */
export async function fetchMyOpportunities(): Promise<DashboardData> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { opportunities: [] };
  }

  let opportunities: DashboardOpportunity[] = [];
  try {
    const { data: oppData } = await supabase
      .from("opportunities")
      .select(
        `
        id,
        title,
        status,
        created_at,
        applications (
          id
        )
      `
      )
      .eq("organization_id", user.id)
      .order("created_at", { ascending: false });

    if (oppData) {
      opportunities = oppData.map((opp) => {
        // Supabase の JOIN 結果を型変換
        const apps = opp.applications as unknown as { id: string }[] | null;

        return {
          id: opp.id as string,
          title: opp.title as string,
          status: opp.status as DashboardOpportunity["status"],
          created_at: opp.created_at as string,
          application_count: Array.isArray(apps) ? apps.length : 0,
        };
      });
    }
  } catch {
    // テーブル未作成・接続エラー時はスキップ
  }

  return { opportunities };
}

/** BIG5 特性キーの一覧 */
const BIG5_TRAIT_KEYS = [
  "extraversion",
  "agreeableness",
  "conscientiousness",
  "neuroticism",
  "openness",
] as const;

/**
 * 募集案件を新規作成する
 *
 * - opportunities テーブルに INSERT
 * - organization_id = 現在のユーザーID
 * - status = 'open'（デフォルト）
 * - required_traits = JSONB（BIG5スコア条件）
 * - 成功後、/dashboard へリダイレクト
 */
export async function createOpportunity(
  formData: FormData
): Promise<CreateOpportunityResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "ログインが必要です" };
  }

  // フォームデータの取得
  const rawTitle = formData.get("title");
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const rawDescription = formData.get("description");
  const description =
    typeof rawDescription === "string" ? rawDescription.trim() : "";

  // バリデーション
  if (!title) {
    return { success: false, error: "タイトルは必須です" };
  }
  if (!description) {
    return { success: false, error: "説明は必須です" };
  }

  // required_traits の構築（BIG5各特性のスコア）
  const requiredTraits: Record<string, number> = {};
  for (const trait of BIG5_TRAIT_KEYS) {
    const value = formData.get(`trait_${trait}`);
    if (value !== null && value !== "") {
      const numValue = Number(value);
      if (!Number.isNaN(numValue) && numValue >= 0 && numValue <= 100) {
        requiredTraits[trait] = numValue;
      }
    }
  }

  try {
    const { error: insertError } = await supabase
      .from("opportunities")
      .insert({
        organization_id: user.id,
        title,
        description,
        required_traits:
          Object.keys(requiredTraits).length > 0 ? requiredTraits : null,
        status: "open",
      });

    if (insertError) {
      return { success: false, error: "案件の作成に失敗しました" };
    }
  } catch {
    return { success: false, error: "予期しないエラーが発生しました" };
  }

  redirect("/dashboard");
}

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
 * 特定の案件に対する応募者一覧を取得する（団体ダッシュボード用）
 *
 * - opportunities テーブルから案件情報を取得
 * - applications + participants を JOIN して応募者一覧を取得
 * - 参加者の診断結果（diagnosis_type, diagnosis_scores）を含める
 * - マッチングスコアを計算
 * - 自団体の案件のみアクセス可能（認可チェック）
 */
export async function fetchApplicantsForOpportunity(
  opportunityId: string
): Promise<ApplicantsResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: "ログインが必要です" };
    }

    // 案件データを取得（自団体の案件であることを確認）
    const { data: oppData, error: oppError } = await supabase
      .from("opportunities")
      .select("id, title, description, status, required_traits, created_at")
      .eq("id", opportunityId)
      .eq("organization_id", user.id)
      .single();

    if (oppError || !oppData) {
      return { data: null, error: "案件が見つかりません" };
    }

    // 応募者一覧を取得（participants JOIN）
    const { data: appData } = await supabase
      .from("applications")
      .select(
        `
        id,
        status,
        message,
        created_at,
        participants (
          name,
          diagnosis_type,
          diagnosis_scores
        )
      `
      )
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false });

    const requiredTraits = (oppData.required_traits as Record<string, number>) ?? null;

    const applicants: Applicant[] = (appData ?? []).map((app) => {
      const participant = app.participants as unknown as {
        name: string;
        diagnosis_type: string | null;
        diagnosis_scores: Record<string, number> | null;
      } | null;

      // マッチングスコアを計算
      let matchScore: number | null = null;
      const rawScores = participant?.diagnosis_scores;
      if (isBIG5Scores(rawScores) && requiredTraits) {
        matchScore = calculateMatchScore(
          rawScores,
          toPartialBIG5Scores(requiredTraits as Record<string, unknown>)
        );
      }

      return {
        id: app.id as string,
        status: app.status as Applicant["status"],
        message: (app.message as string) ?? null,
        created_at: app.created_at as string,
        participant_name: participant?.name ?? "不明",
        diagnosis_type: participant?.diagnosis_type ?? null,
        diagnosis_scores: participant?.diagnosis_scores ?? null,
        match_score: matchScore,
      };
    });

    return {
      data: {
        id: oppData.id as string,
        title: oppData.title as string,
        description: (oppData.description as string) ?? null,
        status: oppData.status as "open" | "closed",
        required_traits: requiredTraits,
        created_at: oppData.created_at as string,
        applicants,
      },
    };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[fetchApplicantsForOpportunity] 予期しないエラー:", err);
    }
    return { data: null, error: "予期しないエラーが発生しました" };
  }
}

/**
 * 応募ステータスを更新する（承認/辞退）
 *
 * - applications.status を 'approved' or 'rejected' に更新
 * - 自団体の案件への応募のみ操作可能（認可チェック）
 */
export async function updateApplicationStatus(
  applicationId: string,
  newStatus: "approved" | "rejected"
): Promise<UpdateApplicationStatusResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "ログインが必要です" };
    }

    // 応募データを取得
    const { data: appData, error: appError } = await supabase
      .from("applications")
      .select("id, opportunity_id")
      .eq("id", applicationId)
      .single();

    if (appError || !appData) {
      return { success: false, error: "応募が見つかりません" };
    }

    // 自団体の案件への応募であることを確認（認可チェック）
    const { data: oppData } = await supabase
      .from("opportunities")
      .select("id")
      .eq("id", appData.opportunity_id)
      .eq("organization_id", user.id)
      .single();

    if (!oppData) {
      return { success: false, error: "この操作を行う権限がありません" };
    }

    // ステータスを更新
    const { error: updateError } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", applicationId);

    if (updateError) {
      return { success: false, error: "ステータスの更新に失敗しました" };
    }

    return { success: true };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[updateApplicationStatus] 予期しないエラー:", err);
    }
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { BIG5Scores } from "@/lib/personality/types";
import { calculateMatchScore } from "@/lib/recommendations/matching";
import type {
  DashboardData,
  DashboardOpportunity,
  CreateOpportunityResult,
  OpportunityEditResult,
  OpportunityEditData,
  OpportunityStatus,
  UpdateOpportunityResult,
  Applicant,
  ApplicantsResult,
  UpdateApplicationStatusResult,
  ApplicantDetail,
  ApplicantDetailResult,
} from "./types";
import { PERSONALITY_TYPES } from "@/lib/personality/constants";

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
 * 編集用：自団体の募集案件を1件取得する
 *
 * - opportunities テーブルから id で取得
 * - organization_id が現在のユーザーIDと一致することを検証
 * - 一致しない or 存在しない場合は null を返す
 */
export async function fetchOpportunityForEdit(
  id: string
): Promise<OpportunityEditResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { opportunity: null, error: "ログインが必要です" };
  }

  try {
    const { data, error: fetchError } = await supabase
      .from("opportunities")
      .select("id, title, description, required_traits, status")
      .eq("id", id)
      .eq("organization_id", user.id)
      .single();

    if (fetchError || !data) {
      return { opportunity: null };
    }

    const opportunity: OpportunityEditData = {
      id: data.id as string,
      title: data.title as string,
      description: (data.description as string) ?? "",
      required_traits:
        (data.required_traits as Record<string, number> | null) ?? null,
      status: data.status as OpportunityStatus,
    };

    return { opportunity };
  } catch {
    return { opportunity: null, error: "データの取得に失敗しました" };
  }
}

/**
 * 募集案件を更新する
 *
 * - opportunities テーブルを UPDATE
 * - organization_id が現在のユーザーIDと一致する案件のみ更新可能
 * - 成功後、/dashboard/opportunities/:id へリダイレクト
 */
export async function updateOpportunity(
  id: string,
  formData: FormData
): Promise<UpdateOpportunityResult> {
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

  // ステータスの取得
  const rawStatus = formData.get("status");
  const status =
    rawStatus === "open" || rawStatus === "closed" ? rawStatus : undefined;

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
    const updateData: Record<string, unknown> = {
      title,
      description,
      required_traits:
        Object.keys(requiredTraits).length > 0 ? requiredTraits : null,
    };
    if (status) {
      updateData.status = status;
    }

    const { error: updateError } = await supabase
      .from("opportunities")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", user.id);

    if (updateError) {
      return { success: false, error: "案件の更新に失敗しました" };
    }
  } catch {
    return { success: false, error: "予期しないエラーが発生しました" };
  }

  redirect(`/dashboard/opportunities/${id}`);
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

    const requiredTraits = oppData.required_traits
      ? (oppData.required_traits as Record<string, number>)
      : null;

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
          toPartialBIG5Scores(requiredTraits)
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
    console.error("[fetchApplicantsForOpportunity] 予期しないエラー:", err);
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
    console.error("[updateApplicationStatus] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

/**
 * 応募者詳細を取得する（団体ダッシュボード用）
 *
 * - applications + participants を JOIN して取得
 * - opportunities テーブルで自団体の案件であることを検証（認可チェック）
 * - PERSONALITY_TYPES から診断タイプの詳細情報を引き当て
 * - マッチングスコアを計算
 */
export async function fetchApplicantDetail(
  applicationId: string
): Promise<ApplicantDetailResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { data: null, error: "ログインが必要です" };
    }

    // 応募データ + 参加者情報を取得
    const { data: appData, error: appError } = await supabase
      .from("applications")
      .select(
        `
        id,
        status,
        message,
        created_at,
        opportunity_id,
        participants (
          name,
          diagnosis_type,
          diagnosis_scores
        )
      `
      )
      .eq("id", applicationId)
      .single();

    if (appError || !appData) {
      return { data: null, error: "応募が見つかりません" };
    }

    // 案件データを取得（自団体の案件であることを確認）
    const { data: oppData, error: oppError } = await supabase
      .from("opportunities")
      .select("id, title, required_traits")
      .eq("id", appData.opportunity_id)
      .eq("organization_id", user.id)
      .single();

    if (oppError || !oppData) {
      return { data: null, error: "この操作を行う権限がありません" };
    }

    const participant = appData.participants as unknown as {
      name: string;
      diagnosis_type: string | null;
      diagnosis_scores: Record<string, number> | null;
    } | null;

    // マッチングスコアを計算
    const requiredTraits = oppData.required_traits
      ? (oppData.required_traits as Record<string, number>)
      : null;
    let matchScore: number | null = null;
    const rawScores = participant?.diagnosis_scores;
    if (isBIG5Scores(rawScores) && requiredTraits) {
      matchScore = calculateMatchScore(
        rawScores,
        toPartialBIG5Scores(requiredTraits)
      );
    }

    // PERSONALITY_TYPES から詳細を引き当て
    const diagnosisType = participant?.diagnosis_type ?? null;
    const typeDetail = diagnosisType
      ? PERSONALITY_TYPES.find((t) => t.name === diagnosisType) ?? null
      : null;

    return {
      data: {
        id: appData.id as string,
        status: appData.status as ApplicantDetail["status"],
        message: (appData.message as string) ?? null,
        created_at: appData.created_at as string,
        participant_name: participant?.name ?? "不明",
        diagnosis_type: diagnosisType,
        diagnosis_scores: participant?.diagnosis_scores ?? null,
        match_score: matchScore,
        opportunity_id: oppData.id as string,
        opportunity_title: oppData.title as string,
        personality_type_detail: typeDetail
          ? {
              name: typeDetail.name,
              nameEn: typeDetail.nameEn,
              description: typeDetail.description,
              strengths: typeDetail.strengths,
              suitableActivities: typeDetail.suitableActivities,
            }
          : null,
      },
    };
  } catch (err) {
    console.error("[fetchApplicantDetail] 予期しないエラー:", err);
    return { data: null, error: "予期しないエラーが発生しました" };
  }
}

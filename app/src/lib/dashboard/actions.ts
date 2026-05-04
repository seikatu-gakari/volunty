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
    // 団体プロフィールIDを取得（organization_id は m_organization_profile.id を参照）
    const { data: orgProfile } = await supabase
      .from("m_organization_profile")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!orgProfile) {
      return { opportunities: [] };
    }

    // 自団体の案件を取得
    const { data: oppData } = await supabase
      .from("m_opportunity")
      .select(
        `
        id,
        title,
        status,
        created_at
      `
      )
      .eq("organization_id", (orgProfile as unknown as { id: string }).id)
      .order("created_at", { ascending: false });

    if (oppData && oppData.length > 0) {
      // 応募者数を別クエリで取得（t_matching_candidate から COUNT）
      const oppIds = oppData.map((o) => o.id as string);
      const { data: matchings } = await supabase
        .from("t_matching_candidate")
        .select("opportunity_id")
        .in("opportunity_id", oppIds);

      const countMap: Record<string, number> = {};
      for (const m of matchings ?? []) {
        const oid = m.opportunity_id as string;
        countMap[oid] = (countMap[oid] ?? 0) + 1;
      }

      opportunities = oppData.map((opp) => ({
        id: opp.id as string,
        title: opp.title as string,
        status: opp.status as DashboardOpportunity["status"],
        created_at: opp.created_at as string,
        application_count: countMap[opp.id as string] ?? 0,
      }));
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
    // 団体プロフィールIDを取得
    const { data: orgProfile, error: profileError } = await supabase
      .from("m_organization_profile")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !orgProfile) {
      return { success: false, error: "団体プロフィールが見つかりません" };
    }

    const { error: insertError } = await supabase
      .from("m_opportunity")
      .insert({
        organization_id: (orgProfile as unknown as { id: string }).id,
        title,
        description,
        requirement_traits:
          Object.keys(requiredTraits).length > 0 ? requiredTraits : null,
        status: "published",
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
    // 団体プロフィールIDを取得
    const { data: orgProfile, error: profileError } = await supabase
      .from("m_organization_profile")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !orgProfile) {
      return { opportunity: null, error: "団体プロフィールが見つかりません" };
    }

    const { data, error: fetchError } = await supabase
      .from("m_opportunity")
      .select("id, title, description, requirement_traits, status")
      .eq("id", id)
      .eq("organization_id", (orgProfile as unknown as { id: string }).id)
      .single();

    if (fetchError || !data) {
      return { opportunity: null };
    }

    const opportunity: OpportunityEditData = {
      id: data.id as string,
      title: data.title as string,
      description: (data.description as string) ?? "",
      required_traits:
        ((data as unknown as { requirement_traits: Record<string, number> | null }).requirement_traits) ?? null,
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
    rawStatus === "draft" || rawStatus === "published" || rawStatus === "closed"
      ? rawStatus
      : undefined;

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
    // 団体プロフィールIDを取得
    const { data: orgProfile, error: profileError } = await supabase
      .from("m_organization_profile")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !orgProfile) {
      return { success: false, error: "団体プロフィールが見つかりません" };
    }

    const updateData: Record<string, unknown> = {
      title,
      description,
      requirement_traits:
        Object.keys(requiredTraits).length > 0 ? requiredTraits : null,
    };
    if (status) {
      updateData.status = status;
    }

    const { error: updateError } = await supabase
      .from("m_opportunity")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", (orgProfile as unknown as { id: string }).id);

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

    // 団体プロフィールIDを取得（認可チェック用）
    const { data: orgProfile, error: profileError } = await supabase
      .from("m_organization_profile")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !orgProfile) {
      return { data: null, error: "団体プロフィールが見つかりません" };
    }

    // 案件データを取得（自団体の案件であることを確認）
    const { data: oppData, error: oppError } = await supabase
      .from("m_opportunity")
      .select("id, title, description, status, requirement_traits, created_at")
      .eq("id", opportunityId)
      .eq("organization_id", (orgProfile as unknown as { id: string }).id)
      .single();

    if (oppError || !oppData) {
      return { data: null, error: "案件が見つかりません" };
    }

    // 応募者一覧を取得（t_matching_candidate）
    const { data: matchingData } = await supabase
      .from("t_matching_candidate")
      .select("id, status, message, match_score, applied_at, participant_id")
      .eq("opportunity_id", opportunityId)
      .order("applied_at", { ascending: false });

    // 参加者プロフィールを別クエリで取得（split-fetch パターン）
    const participantIds = (matchingData ?? []).map(
      (m) => m.participant_id as string
    );
    const profileMap: Record<
      string,
      {
        name: string;
        diagnosis_type: string | null;
        diagnosis_scores: Record<string, number> | null;
      }
    > = {};

    if (participantIds.length > 0) {
      const { data: profiles } = await supabase
        .from("m_participant_profile")
        .select("user_id, name, diagnosis_type, diagnosis_scores")
        .in("user_id", participantIds);

      for (const p of profiles ?? []) {
        profileMap[p.user_id as string] = {
          name: p.name as string,
          diagnosis_type: (p.diagnosis_type as string) ?? null,
          diagnosis_scores:
            (p.diagnosis_scores as Record<string, number>) ?? null,
        };
      }
    }

    const requiredTraits = (
      oppData as unknown as {
        requirement_traits: Record<string, number> | null;
      }
    ).requirement_traits;

    const applicants: Applicant[] = (matchingData ?? []).map((m) => {
      const profile = profileMap[m.participant_id as string];

      // マッチングスコアを計算（DBの match_score を優先使用）
      let matchScore: number | null = (m.match_score as number) ?? null;
      const rawScores = profile?.diagnosis_scores;
      if (matchScore === null && isBIG5Scores(rawScores) && requiredTraits) {
        matchScore = calculateMatchScore(
          rawScores,
          toPartialBIG5Scores(requiredTraits)
        );
      }

      return {
        id: m.id as string,
        status: mapApplicationStatus(m.status as string),
        message: (m.message as string) ?? null,
        created_at: (m.applied_at as string) ?? "",
        participant_name: profile?.name ?? "不明",
        diagnosis_type: profile?.diagnosis_type ?? null,
        diagnosis_scores: profile?.diagnosis_scores ?? null,
        match_score: matchScore,
      };
    });

    return {
      data: {
        id: oppData.id as string,
        title: oppData.title as string,
        description: (oppData.description as string) ?? null,
        status: oppData.status as "draft" | "published" | "closed",
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
 * DB の MatchingStatus を UI 表示用の ApplicationStatus にマッピングする
 */
function mapApplicationStatus(dbStatus: string): Applicant["status"] {
  if (dbStatus === "applied" || dbStatus === "queued") return "pending";
  if (dbStatus === "accepted" || dbStatus === "completed") return "approved";
  if (dbStatus === "declined") return "rejected";
  return "pending";
}

/**
 * 応募ステータスを更新する（承認/辞退）
 *
 * - t_matching_candidate.status を 'accepted' or 'declined' に更新
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
      .from("t_matching_candidate")
      .select("id, opportunity_id")
      .eq("id", applicationId)
      .single();

    if (appError || !appData) {
      return { success: false, error: "応募が見つかりません" };
    }

    // 団体プロフィールIDを取得（認可チェック用）
    const { data: orgProfile, error: profileError } = await supabase
      .from("m_organization_profile")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !orgProfile) {
      return { success: false, error: "団体プロフィールが見つかりません" };
    }

    // 自団体の案件への応募であることを確認（認可チェック）
    const { data: oppData } = await supabase
      .from("m_opportunity")
      .select("id")
      .eq("id", appData.opportunity_id)
      .eq("organization_id", (orgProfile as unknown as { id: string }).id)
      .single();

    if (!oppData) {
      return { success: false, error: "この操作を行う権限がありません" };
    }

    // UI ステータスを DB ステータスにマッピング
    const dbStatus = newStatus === "approved" ? "accepted" : "declined";

    // ステータスを更新
    const { error: updateError } = await supabase
      .from("t_matching_candidate")
      .update({ status: dbStatus })
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

    // 応募データを取得
    const { data: appData, error: appError } = await supabase
      .from("t_matching_candidate")
      .select("id, status, message, match_score, applied_at, opportunity_id, participant_id")
      .eq("id", applicationId)
      .single();

    if (appError || !appData) {
      return { data: null, error: "応募が見つかりません" };
    }

    // 団体プロフィールIDを取得（認可チェック用）
    const { data: orgProfile, error: profileError } = await supabase
      .from("m_organization_profile")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !orgProfile) {
      return { data: null, error: "団体プロフィールが見つかりません" };
    }

    // 案件データを取得（自団体の案件であることを確認）
    const { data: oppData, error: oppError } = await supabase
      .from("m_opportunity")
      .select("id, title, requirement_traits")
      .eq("id", appData.opportunity_id)
      .eq("organization_id", (orgProfile as unknown as { id: string }).id)
      .single();

    if (oppError || !oppData) {
      return { data: null, error: "この操作を行う権限がありません" };
    }

    // 参加者プロフィールを個別取得
    const { data: profileData } = await supabase
      .from("m_participant_profile")
      .select("name, diagnosis_type, diagnosis_scores")
      .eq("user_id", appData.participant_id)
      .single();

    const participant = profileData
      ? {
          name: profileData.name as string,
          diagnosis_type: (profileData.diagnosis_type as string) ?? null,
          diagnosis_scores:
            (profileData.diagnosis_scores as Record<string, number>) ?? null,
        }
      : null;

    // マッチングスコアを計算
    const requiredTraits = (
      oppData as unknown as {
        requirement_traits: Record<string, number> | null;
      }
    ).requirement_traits;
    let matchScore: number | null = (appData.match_score as number) ?? null;
    const rawScores = participant?.diagnosis_scores;
    if (matchScore === null && isBIG5Scores(rawScores) && requiredTraits) {
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
        status: mapApplicationStatus(appData.status as string),
        message: (appData.message as string) ?? null,
        created_at: (appData.applied_at as string) ?? "",
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

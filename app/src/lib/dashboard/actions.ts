"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  fetchMatchingHistoryQuery,
  fetchRecommendedParticipantDetailQuery,
  fetchRecommendedParticipantsQuery,
} from "./queries";
import type {
  DashboardData,
  DashboardOpportunity,
  CreateOpportunityResult,
  ApplicantListOptions,
  OpportunityEditResult,
  OpportunityEditData,
  OpportunityStatus,
  UpdateOpportunityResult,
  Applicant,
  ApplicantsResult,
  BulkCompleteApplicationsResult,
  DashboardAnalyticsResult,
  UpdateApplicationStatusResult,
  ApplicantDetailResult,
  MatchingHistoryResult,
  RecommendedParticipantDetailResult,
  RecommendedParticipantsResult,
} from "./types";
import { findStyleTypeById } from "@/lib/diagnosis-scale/style-types";
import { toActivityStyleTagIds } from "@/lib/recommendations/activity-style-tags";
import {
  isValidCategory,
  isValidParticipationMode,
  type ParticipationMode,
} from "@/lib/opportunities/constants";
import {
  resolvePublicationState,
  type OpportunityPublicationState,
  type PublicationOperation,
} from "@/lib/opportunities/publication";

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

async function fetchApprovedOrganizationProfile(
  userId: string
): Promise<{ id: string } | { error: string }> {
  const organizationProfile = await prisma.organizationProfile.findUnique({
    where: { userId },
    select: { id: true, reviewStatus: true },
  });

  if (!organizationProfile) {
    return { error: "団体プロフィールが見つかりません" };
  }

  if (organizationProfile.reviewStatus !== "approved") {
    return { error: "承認済み団体のみ利用できます" };
  }

  return { id: organizationProfile.id };
}

/**
 * 団体向けおすすめ参加者一覧を取得する。
 *
 * 自団体の公開中募集案件ごとに参加者との相性を計算し、
 * 参加者ごとの最高スコアを代表スコアとして返す。
 */
export async function fetchRecommendedParticipants(): Promise<RecommendedParticipantsResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { participants: [], error: "ログインが必要です" };
    }
    return fetchRecommendedParticipantsQuery(user.id);
  } catch (err) {
    console.error("[fetchRecommendedParticipants] 予期しないエラー:", err);
    return { participants: [], error: "予期しないエラーが発生しました" };
  }
}

/**
 * 団体向けおすすめ参加者の詳細を取得する。
 *
 * 非公開プロフィール・存在しないプロフィールは参加者なしとして扱う。
 * 診断未実施の参加者も表示する（性格だけで機会を奪わない）。
 */
export async function fetchRecommendedParticipantDetail(
  participantProfileId: string
): Promise<RecommendedParticipantDetailResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { participant: null, error: "ログインが必要です" };
    }
    return fetchRecommendedParticipantDetailQuery(user.id, participantProfileId);
  } catch (err) {
    console.error("[fetchRecommendedParticipantDetail] 予期しないエラー:", err);
    return { participant: null, error: "予期しないエラーが発生しました" };
  }
}

/** DATE カラムの値を YYYY-MM-DD に正規化する（ISO タイムスタンプにも対応） */
function normalizeDateOnly(value: string | null): string | null {
  if (!value) return null;
  // "2026-06-19" や "2026-06-19T00:00:00.000Z" の先頭10文字を取り出す
  return value.slice(0, 10);
}

/** YYYY-MM-DD 形式の日付文字列か判定する */
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value);
  return !Number.isNaN(time);
}

/** 募集案件の追加項目（場所・日程・定員・カテゴリ・参加形態）のパース結果 */
interface OpportunityExtraFields {
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  capacity: number | null;
  category: string | null;
  participation_mode: ParticipationMode | null;
}

/**
 * FormData から募集案件の追加項目を取得・検証する。
 * すべて任意項目だが、値がある場合は整合性を検証する。
 * 検証エラー時は { error } を返す。
 */
function parseOpportunityExtraFields(
  formData: FormData
): { data: OpportunityExtraFields } | { error: string } {
  const getTrimmed = (key: string): string => {
    const raw = formData.get(key);
    return typeof raw === "string" ? raw.trim() : "";
  };

  const location = getTrimmed("location");
  const startDate = getTrimmed("startDate");
  const endDate = getTrimmed("endDate");
  const capacityRaw = getTrimmed("capacity");
  const category = getTrimmed("category");
  const participationMode = getTrimmed("participationMode");

  // 日付の検証
  if (startDate && !isValidDateString(startDate)) {
    return { error: "開始日の形式が正しくありません" };
  }
  if (endDate && !isValidDateString(endDate)) {
    return { error: "終了日の形式が正しくありません" };
  }
  if (startDate && endDate && endDate < startDate) {
    return { error: "終了日は開始日以降の日付を指定してください" };
  }

  // 定員の検証
  let capacity: number | null = null;
  if (capacityRaw) {
    const num = Number(capacityRaw);
    if (!Number.isInteger(num) || num <= 0) {
      return { error: "定員は1以上の整数で入力してください" };
    }
    capacity = num;
  }

  // カテゴリの検証
  if (category && !isValidCategory(category)) {
    return { error: "カテゴリの値が正しくありません" };
  }

  // 参加形態の検証
  if (participationMode && !isValidParticipationMode(participationMode)) {
    return { error: "参加形態の値が正しくありません" };
  }

  return {
    data: {
      location: location || null,
      start_date: startDate || null,
      end_date: endDate || null,
      capacity,
      category: category || null,
      participation_mode: participationMode
        ? (participationMode as ParticipationMode)
        : null,
    },
  };
}

function parsePublishFields(
  formData: FormData,
  nowIso: string
): { data: { status: OpportunityStatus; published_at: string | null } } | { error: string } {
  const rawPublishMode = formData.get("publishMode");
  const publishMode =
    rawPublishMode === null
      ? "published"
      : rawPublishMode === "draft" ||
          rawPublishMode === "published" ||
          rawPublishMode === "scheduled"
        ? rawPublishMode
        : null;

  if (!publishMode) {
    return { error: "公開方法の値が正しくありません" };
  }

  if (publishMode === "draft") {
    return { data: { status: "draft", published_at: null } };
  }

  if (publishMode === "scheduled") {
    const rawPublishedAt = formData.get("publishedAt");
    const publishedAt =
      typeof rawPublishedAt === "string" ? rawPublishedAt.trim() : "";
    if (!publishedAt) {
      return { error: "公開予約日時を入力してください" };
    }
    const scheduledAt = new Date(publishedAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return { error: "公開予約日時の形式が正しくありません" };
    }
    return {
      data: {
        status: "published",
        published_at: scheduledAt.toISOString(),
      },
    };
  }

  return { data: { status: "published", published_at: nowIso } };
}

function parseOpportunityStatusField(
  formData: FormData
): { status: OpportunityStatus | undefined } | { error: string } {
  const rawStatus = formData.get("status");
  if (rawStatus === null) return { status: undefined };
  if (
    rawStatus === "draft" ||
    rawStatus === "published" ||
    rawStatus === "closed"
  ) {
    return { status: rawStatus };
  }
  return { error: "案件ステータスの値が正しくありません" };
}

function parseUpdatePublicationFields(
  formData: FormData,
  now: Date
): { data: { operation: PublicationOperation | null } } | { error: string } {
  const statusResult = parseOpportunityStatusField(formData);
  if ("error" in statusResult) return statusResult;

  const status = statusResult.status;
  if (!formData.has("publishMode")) {
    return {
      data: {
        operation:
          status === undefined ? null : { kind: "status", status },
      },
    };
  }

  const publish = parsePublishFields(formData, now.toISOString());
  if ("error" in publish) return publish;

  const rawPublishMode = formData.get("publishMode");
  if (
    rawPublishMode !== "draft" &&
    rawPublishMode !== "published" &&
    rawPublishMode !== "scheduled"
  ) {
    return { error: "公開方法の値が正しくありません" };
  }

  const publishStatus = rawPublishMode === "draft" ? "draft" : "published";
  if (status !== undefined && status !== publishStatus) {
    return { error: "案件ステータスと公開方法の指定が一致しません" };
  }

  if (rawPublishMode === "scheduled") {
    if (!publish.data.published_at) {
      return { error: "公開予約日時を入力してください" };
    }
    return {
      data: {
        operation: {
          kind: "publishMode",
          mode: "scheduled",
          publishedAt: new Date(publish.data.published_at),
        },
      },
    };
  }

  return {
    data: {
      operation: { kind: "publishMode", mode: rawPublishMode },
    },
  };
}

function parseCurrentPublicationState(
  value: unknown
): OpportunityPublicationState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const status = row.status;
  const publishedAt = row.published_at;
  if (
    status !== "draft" &&
    status !== "published" &&
    status !== "closed"
  ) {
    return null;
  }
  if (publishedAt !== null && typeof publishedAt !== "string") {
    return null;
  }

  return { status, publishedAt };
}

function serializePublicationDate(
  value: OpportunityPublicationState["publishedAt"]
): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

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

  // 活動スタイルタグ・参加要件の取得と検証
  const matching = parseOpportunityMatchingFields(formData);
  if ("error" in matching) {
    return { success: false, error: matching.error };
  }

  // 追加項目（場所・日程・定員・カテゴリ・参加形態）の取得と検証
  const extra = parseOpportunityExtraFields(formData);
  if ("error" in extra) {
    return { success: false, error: extra.error };
  }

  const now = new Date().toISOString();
  const publish = parsePublishFields(formData, now);
  if ("error" in publish) {
    return { success: false, error: publish.error };
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

    // Supabase REST経由ではPrismaの @updatedAt が適用されないため明示する。
    const { error: insertError } = await supabase
      .from("m_opportunity")
      .insert({
        organization_id: (orgProfile as unknown as { id: string }).id,
        title,
        description,
        ...matching.data,
        status: publish.data.status,
        published_at: publish.data.published_at,
        created_at: now,
        updated_at: now,
        ...extra.data,
      });

    if (insertError) {
      console.error("[createOpportunity] INSERT failed", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });
      return { success: false, error: "案件の作成に失敗しました" };
    }
  } catch {
    return { success: false, error: "予期しないエラーが発生しました" };
  }

  redirect("/dashboard");
}

/**
 * 活動スタイルタグ・参加要件（資格・年齢）のパース結果
 */
interface OpportunityMatchingFields {
  activity_style_tags: string[] | null;
  required_qualifications: string[] | null;
  min_age: number | null;
  max_age: number | null;
}

/**
 * FormData から活動スタイルタグと参加要件を取得・検証する。
 * 旧「求める性格特性（BIG5数値）」の入力は廃止した。
 */
function parseOpportunityMatchingFields(
  formData: FormData
): { data: OpportunityMatchingFields } | { error: string } {
  const rawTags = formData
    .getAll("activityStyleTags")
    .filter((tag): tag is string => typeof tag === "string");
  const activityStyleTags = toActivityStyleTagIds(rawTags);
  if (rawTags.length !== activityStyleTags.length) {
    return { error: "活動スタイルタグの値が正しくありません" };
  }
  if (activityStyleTags.length > 3) {
    return { error: "活動スタイルタグは3つまで選択できます" };
  }

  const rawQualifications = formData.get("requiredQualifications");
  const requiredQualifications =
    typeof rawQualifications === "string"
      ? rawQualifications
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      : [];

  const parseAge = (key: string): { value: number | null } | { error: string } => {
    const raw = formData.get(key);
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed) return { value: null };
    const num = Number(trimmed);
    if (!Number.isInteger(num) || num < 0 || num > 120) {
      return { error: "年齢要件は0〜120の整数で入力してください" };
    }
    return { value: num };
  };

  const minAge = parseAge("minAge");
  if ("error" in minAge) return { error: minAge.error };
  const maxAge = parseAge("maxAge");
  if ("error" in maxAge) return { error: maxAge.error };
  if (
    minAge.value !== null &&
    maxAge.value !== null &&
    maxAge.value < minAge.value
  ) {
    return { error: "対象年齢の上限は下限以上にしてください" };
  }

  return {
    data: {
      activity_style_tags:
        activityStyleTags.length > 0 ? activityStyleTags : null,
      required_qualifications:
        requiredQualifications.length > 0 ? requiredQualifications : null,
      min_age: minAge.value,
      max_age: maxAge.value,
    },
  };
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
      .select(
        "id, title, description, activity_style_tags, required_qualifications, min_age, max_age, status, location, start_date, end_date, capacity, category, participation_mode"
      )
      .eq("id", id)
      .eq("organization_id", (orgProfile as unknown as { id: string }).id)
      .single();

    if (fetchError || !data) {
      return { opportunity: null };
    }

    const row = data as unknown as {
      id: string;
      title: string;
      description: string | null;
      activity_style_tags: unknown;
      required_qualifications: unknown;
      min_age: number | null;
      max_age: number | null;
      status: OpportunityStatus;
      location: string | null;
      start_date: string | null;
      end_date: string | null;
      capacity: number | null;
      category: string | null;
      participation_mode: ParticipationMode | null;
    };

    const opportunity: OpportunityEditData = {
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      activity_style_tags: toActivityStyleTagIds(row.activity_style_tags),
      required_qualifications: Array.isArray(row.required_qualifications)
        ? row.required_qualifications.filter(
            (item): item is string => typeof item === "string"
          )
        : [],
      min_age: row.min_age ?? null,
      max_age: row.max_age ?? null,
      status: row.status,
      location: row.location ?? null,
      // DATE カラムは YYYY-MM-DD 形式に正規化（<input type="date"> 用）
      start_date: normalizeDateOnly(row.start_date),
      end_date: normalizeDateOnly(row.end_date),
      capacity: row.capacity ?? null,
      category: row.category ?? null,
      participation_mode: row.participation_mode ?? null,
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

  // 活動スタイルタグ・参加要件の取得と検証
  const matching = parseOpportunityMatchingFields(formData);
  if ("error" in matching) {
    return { success: false, error: matching.error };
  }

  // 追加項目（場所・日程・定員・カテゴリ・参加形態）の取得と検証
  const extra = parseOpportunityExtraFields(formData);
  if ("error" in extra) {
    return { success: false, error: extra.error };
  }

  const now = new Date();
  const publication = parseUpdatePublicationFields(formData, now);
  if ("error" in publication) {
    return { success: false, error: publication.error };
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

    const organizationId = (orgProfile as unknown as { id: string }).id;
    const {
      data: currentOpportunity,
      error: currentOpportunityError,
    } = await supabase
      .from("m_opportunity")
      .select("status, published_at")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();

    if (currentOpportunityError) {
      if (currentOpportunityError.code === "PGRST116") {
        return { success: false, error: "案件が見つかりません" };
      }
      return { success: false, error: "案件の更新に失敗しました" };
    }
    if (!currentOpportunity) {
      return { success: false, error: "案件が見つかりません" };
    }

    const currentPublication = parseCurrentPublicationState(currentOpportunity);
    if (!currentPublication) {
      return { success: false, error: "案件の更新に失敗しました" };
    }

    const updateData: Record<string, unknown> = {
      title,
      description,
      ...matching.data,
      ...extra.data,
    };
    if (publication.data.operation) {
      const nextPublication = resolvePublicationState(
        currentPublication,
        publication.data.operation,
        now,
      );
      updateData.status = nextPublication.status;
      updateData.published_at = serializePublicationDate(
        nextPublication.publishedAt,
      );
    }

    const updateQuery = supabase
      .from("m_opportunity")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("status", currentPublication.status);

    const currentPublishedAt = serializePublicationDate(
      currentPublication.publishedAt,
    );
    const { data: updatedOpportunities, error: updateError } =
      currentPublishedAt === null
        ? await updateQuery.is("published_at", null).select("id")
        : await updateQuery
            .eq("published_at", currentPublishedAt)
            .select("id");

    if (updateError) {
      return { success: false, error: "案件の更新に失敗しました" };
    }
    if (
      !Array.isArray(updatedOpportunities) ||
      updatedOpportunities.length !== 1
    ) {
      return {
        success: false,
        error: "公開状態が変更されています。画面を再読み込みしてから保存してください",
      };
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
  opportunityId: string,
  options: ApplicantListOptions = {}
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
      .select("id, title, description, status, created_at")
      .eq("id", opportunityId)
      .eq("organization_id", (orgProfile as unknown as { id: string }).id)
      .single();

    if (oppError || !oppData) {
      return { data: null, error: "案件が見つかりません" };
    }

    // 応募者一覧を取得（t_matching_candidate）
    const { data: matchingData } = await supabase
      .from("t_matching_candidate")
      .select(
        "id, status, message, applied_at, status_changed_at, participant_id"
      )
      .eq("opportunity_id", opportunityId)
      .order("applied_at", { ascending: false });

    // 自団体案件の応募者だけをRLSの影響を受けないサーバー側で取得する。
    // m_participant_profile / t_diagnosis_result は参加者本人限定のRLSのため、
    // 団体セッションのSupabaseクライアントでは取得できない。
    const participantIds = (matchingData ?? []).map(
      (m) => m.participant_id as string
    );
    const profileMap: Record<
      string,
      { name: string; styleTypeLabel: string | null }
    > = {};

    if (participantIds.length > 0) {
      const participants = await prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: {
          id: true,
          name: true,
          participantProfile: {
            select: {
              name: true,
              latestDiagnosisResult: { select: { styleTypeId: true } },
            },
          },
        },
      });

      for (const participant of participants) {
        const profile = participant.participantProfile;
        const styleTypeId = profile?.latestDiagnosisResult?.styleTypeId ?? null;
        profileMap[participant.id] = {
          name: profile?.name ?? participant.name ?? "不明",
          styleTypeLabel: styleTypeId
            ? (findStyleTypeById(styleTypeId)?.name ?? null)
            : null,
        };
      }
    }

    const applicants: Applicant[] = (matchingData ?? [])
      .map((m) => {
        const profile = profileMap[m.participant_id as string];

        return {
          id: m.id as string,
          status: mapApplicationStatus(m.status as string),
          message: (m.message as string) ?? null,
          created_at: (m.applied_at as string) ?? "",
          completed_at:
            m.status === "completed" ? (m.status_changed_at as string) : null,
          participant_name: profile?.name ?? "不明",
          style_type_label: profile?.styleTypeLabel ?? null,
        };
      })
      .filter((applicant) => {
        const status = options.status ?? "all";
        return status === "all" || applicant.status === status;
      });

    const compareAppliedDesc = (a: Applicant, b: Applicant) => {
      const appliedAtA = Date.parse(a.created_at);
      const appliedAtB = Date.parse(b.created_at);
      const timeA = Number.isNaN(appliedAtA) ? 0 : appliedAtA;
      const timeB = Number.isNaN(appliedAtB) ? 0 : appliedAtB;

      if (timeA !== timeB) {
        return timeB - timeA;
      }

      return a.id.localeCompare(b.id);
    };

    applicants.sort((a, b) => {
      switch (options.sort ?? "applied_desc") {
        case "applied_asc":
          return -compareAppliedDesc(a, b);
        case "compatibility": {
          const styleA = a.style_type_label ? 0 : 1;
          const styleB = b.style_type_label ? 0 : 1;
          if (styleA !== styleB) return styleA - styleB;
          return compareAppliedDesc(a, b);
        }
        case "applied_desc":
        default:
          return compareAppliedDesc(a, b);
      }
    });

    return {
      data: {
        id: oppData.id as string,
        title: oppData.title as string,
        description: (oppData.description as string) ?? null,
        status: oppData.status as "draft" | "published" | "closed",
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
  if (dbStatus === "accepted") return "approved";
  if (dbStatus === "completed") return "completed";
  if (dbStatus === "declined") return "rejected";
  return "pending";
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toApplicantDetailIsoString(value: Date | string): string {
  return toIsoString(value).replace(".000Z", "Z");
}

/**
 * 団体向けマッチング履歴を取得する。
 *
 * 自団体の応募のうち、承認・辞退・活動完了済みのものだけを処理日時順で返す。
 */
export async function fetchMatchingHistory(): Promise<MatchingHistoryResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { history: [], error: "ログインが必要です" };
    }
    return fetchMatchingHistoryQuery(user.id);
  } catch (err) {
    console.error("[fetchMatchingHistory] 予期しないエラー:", err);
    return { history: [], error: "予期しないエラーが発生しました" };
  }
}

/**
 * 応募ステータスを更新する（承認/辞退）
 *
 * - t_matching_candidate.status を 'accepted' or 'declined' に更新
 * - 自団体の案件への応募のみ操作可能（認可チェック）
 */
export async function updateApplicationStatus(
  applicationId: string,
  newStatus: "approved" | "rejected" | "completed"
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
      .select("id, opportunity_id, status")
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

    if (newStatus === "completed" && appData.status !== "accepted") {
      return {
        success: false,
        error: "承認済みの応募のみ活動完了にできます",
      };
    }

    // UI ステータスを DB ステータスにマッピング
    const dbStatus =
      newStatus === "approved"
        ? "accepted"
        : newStatus === "rejected"
          ? "declined"
          : "completed";
    const now = new Date().toISOString();

    // ステータスを更新
    const { error: updateError } = await supabase
      .from("t_matching_candidate")
      .update({ status: dbStatus, status_changed_at: now, updated_at: now })
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

export async function bulkCompleteApplications(
  opportunityId: string,
  applicationIds: string[]
): Promise<BulkCompleteApplicationsResult> {
  const uniqueIds = Array.from(new Set(applicationIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return {
      success: false,
      completedCount: 0,
      failedCount: 0,
      error: "活動完了にする応募を選択してください",
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        completedCount: 0,
        failedCount: uniqueIds.length,
        error: "ログインが必要です",
      };
    }

    const organizationProfile = await fetchApprovedOrganizationProfile(user.id);
    if ("error" in organizationProfile) {
      return {
        success: false,
        completedCount: 0,
        failedCount: uniqueIds.length,
        error: organizationProfile.error,
      };
    }

    const completable = await prisma.matchingCandidate.findMany({
      where: {
        id: { in: uniqueIds },
        opportunityId,
        status: "accepted",
        opportunity: { organizationId: organizationProfile.id },
      },
      select: { id: true },
    });

    const completableIds = completable.map((application) => application.id);
    if (completableIds.length > 0) {
      await prisma.matchingCandidate.updateMany({
        where: { id: { in: completableIds } },
        data: {
          status: "completed",
          statusChangedAt: new Date(),
        },
      });
    }

    return {
      success: completableIds.length > 0,
      completedCount: completableIds.length,
      failedCount: uniqueIds.length - completableIds.length,
    };
  } catch (err) {
    console.error("[bulkCompleteApplications] 予期しないエラー:", err);
    return {
      success: false,
      completedCount: 0,
      failedCount: uniqueIds.length,
      error: "予期しないエラーが発生しました",
    };
  }
}

export async function fetchDashboardAnalytics(): Promise<DashboardAnalyticsResult> {
  const emptyApproaches = {
    sentTotal: 0,
    acceptedCount: 0,
    acceptanceRate: 0,
    declinedCount: 0,
    pendingCount: 0,
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        opportunities: [],
        approaches: emptyApproaches,
        error: "ログインが必要です",
      };
    }

    const organizationProfile = await fetchApprovedOrganizationProfile(user.id);
    if ("error" in organizationProfile) {
      return {
        opportunities: [],
        approaches: emptyApproaches,
        error: organizationProfile.error,
      };
    }

    const opportunities = await prisma.opportunity.findMany({
      where: { organizationId: organizationProfile.id },
      select: { id: true, title: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    const opportunityIds = opportunities.map((opportunity) => opportunity.id);

    const [matchingGroups, viewGroups, approachGroups] = await Promise.all([
      prisma.matchingCandidate.groupBy({
        by: ["opportunityId", "status"],
        where: { opportunityId: { in: opportunityIds } },
        _count: { _all: true },
      }),
      prisma.engagementEvent.groupBy({
        by: ["opportunityId"],
        where: {
          opportunityId: { in: opportunityIds },
          event: "view",
        },
        _count: { _all: true },
      }),
      prisma.approach.groupBy({
        by: ["status"],
        where: { organizationId: organizationProfile.id },
        _count: { _all: true },
      }),
    ]);

    const matchingByOpportunity = new Map<string, Record<string, number>>();
    for (const group of matchingGroups) {
      const current = matchingByOpportunity.get(group.opportunityId) ?? {};
      current[group.status] = group._count._all;
      matchingByOpportunity.set(group.opportunityId, current);
    }

    const viewsByOpportunity = new Map(
      viewGroups.map((group) => [group.opportunityId, group._count._all])
    );

    const analytics = opportunities.map((opportunity) => {
      const counts = matchingByOpportunity.get(opportunity.id) ?? {};
      const applicationCount = Object.values(counts).reduce(
        (total, count) => total + count,
        0
      );
      const completedCount = counts.completed ?? 0;
      const approvedCount = (counts.accepted ?? 0) + completedCount;
      return {
        opportunityId: opportunity.id,
        title: opportunity.title,
        viewCount: viewsByOpportunity.get(opportunity.id) ?? 0,
        applicationCount,
        approvedCount,
        approvalRate:
          applicationCount > 0
            ? Math.round((approvedCount / applicationCount) * 100)
            : 0,
        declinedCount: counts.declined ?? 0,
        completedCount,
      };
    });

    const approachCounts = Object.fromEntries(
      approachGroups.map((group) => [group.status, group._count._all])
    ) as Record<string, number>;
    const sentTotal = Object.values(approachCounts).reduce(
      (total, count) => total + count,
      0
    );
    const acceptedCount = approachCounts.accepted ?? 0;

    return {
      opportunities: analytics,
      approaches: {
        sentTotal,
        acceptedCount,
        acceptanceRate:
          sentTotal > 0 ? Math.round((acceptedCount / sentTotal) * 100) : 0,
        declinedCount: approachCounts.declined ?? 0,
        pendingCount: approachCounts.sent ?? 0,
      },
    };
  } catch (err) {
    console.error("[fetchDashboardAnalytics] 予期しないエラー:", err);
    return {
      opportunities: [],
      approaches: emptyApproaches,
      error: "予期しないエラーが発生しました",
    };
  }
}

/**
 * 応募者詳細を取得する（団体ダッシュボード用）
 *
 * - Prisma で応募・参加者・最新診断結果を取得
 * - 応募IDと案件の団体IDを同じクエリ条件で検証（認可チェック）
 * - 活動スタイルの参考タイプのみ返し、生スコアは返さない
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

    const organizationProfile = await prisma.organizationProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        reviewStatus: true,
        user: { select: { role: true } },
      },
    });

    if (!organizationProfile) {
      return { data: null, error: "団体プロフィールが見つかりません" };
    }

    if (organizationProfile.user.role !== "organization") {
      return { data: null, error: "団体アカウントのみ利用できます" };
    }

    if (organizationProfile.reviewStatus !== "approved") {
      return { data: null, error: "承認済み団体のみ利用できます" };
    }

    const application = await prisma.matchingCandidate.findFirst({
      where: {
        id: applicationId,
        opportunity: { organizationId: organizationProfile.id },
      },
      select: {
        id: true,
        status: true,
        message: true,
        appliedAt: true,
        statusChangedAt: true,
        participant: {
          select: {
            id: true,
            name: true,
            participantProfile: {
              select: {
                name: true,
                latestDiagnosisResult: {
                  select: { styleTypeId: true },
                },
              },
            },
          },
        },
        opportunity: {
          select: { id: true, title: true },
        },
      },
    });

    if (!application) {
      return { data: null, error: "この操作を行う権限がありません" };
    }

    const participantProfile = application.participant.participantProfile;
    const participantLineId =
      application.status === "accepted"
        ? (
            await prisma.participantProfile.findUnique({
              where: { userId: application.participant.id },
              select: { lineId: true },
            })
          )?.lineId ?? null
        : undefined;
    const styleTypeId =
      participantProfile?.latestDiagnosisResult?.styleTypeId ?? null;
    const styleType = styleTypeId
      ? (findStyleTypeById(styleTypeId) ?? null)
      : null;

    return {
      data: {
        id: application.id,
        status: mapApplicationStatus(application.status),
        message: application.message,
        created_at: application.appliedAt
          ? toApplicantDetailIsoString(application.appliedAt)
          : "",
        completed_at:
          application.status === "completed"
            ? toApplicantDetailIsoString(application.statusChangedAt)
            : null,
        participant_name:
          participantProfile?.name ?? application.participant.name ?? "不明",
        ...(application.status === "accepted"
          ? { participant_line_id: participantLineId }
          : {}),
        style_type_label: styleType?.name ?? null,
        opportunity_id: application.opportunity.id,
        opportunity_title: application.opportunity.title,
        style_type_detail: styleType
          ? {
              name: styleType.name,
              nameEn: styleType.nameEn,
              description: styleType.description,
              tendencies: styleType.tendencies,
              activityExamples: styleType.activityExamples,
            }
          : null,
      },
    };
  } catch (err) {
    console.error("[fetchApplicantDetail] 予期しないエラー:", err);
    return { data: null, error: "予期しないエラーが発生しました" };
  }
}

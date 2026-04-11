"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type {
  RegisterParticipantData,
  RegisterParticipantResult,
  RegisterOrganizationData,
  RegisterOrganizationResult,
} from "./types";

/**
 * ロール選択 — user_metadata と m_user のロールを更新
 */
export async function selectRole(role: "participant" | "organization") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です");

  // Supabase Auth メタデータを更新
  const { error: authError } = await supabase.auth.updateUser({
    data: { role },
  });
  if (authError) throw new Error(`ロール更新に失敗しました: ${authError.message}`);

  // DB のロールも同期
  await prisma.user.update({
    where: { id: user.id },
    data: { role },
  });

  redirect(
    role === "organization"
      ? "/onboarding/organization"
      : "/onboarding/participant"
  );
}

/**
 * 参加者プロフィールを登録する
 *
 * - participants テーブルに INSERT
 * - id は認証済みユーザーの UUID を使用
 */
export async function registerParticipant(
  data: RegisterParticipantData
): Promise<RegisterParticipantResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "ログインが必要です" };
    }

    // 必須フィールドのバリデーション
    if (!data.name?.trim()) {
      return { success: false, error: "表示名は必須です" };
    }
    if (!data.birthday?.trim()) {
      return { success: false, error: "生年月日は必須です" };
    }
    // 生年月日の日付妥当性チェック（YYYY-MM-DD形式）
    const birthdayDate = new Date(data.birthday);
    if (
      isNaN(birthdayDate.getTime()) ||
      birthdayDate > new Date() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.birthday)
    ) {
      return { success: false, error: "有効な生年月日を入力してください" };
    }
    if (!data.region?.trim()) {
      return { success: false, error: "都道府県は必須です" };
    }

    const { error: insertError } = await supabase.from("participants").insert({
      id: user.id,
      name: data.name,
      birthday: data.birthday,
      gender: data.gender || null,
      region: data.region,
      bio: data.bio || null,
      interests:
        data.interests && data.interests.length > 0 ? data.interests : null,
    });

    if (insertError) {
      return { success: false, error: "プロフィールの登録に失敗しました" };
    }

    return { success: true };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[registerParticipant] 予期しないエラー:", err);
    }
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

/**
 * 団体プロフィール充実度スコアを計算する（0-100）
 *
 * - 必須4項目（各10点）: 40点
 * - 団体説明: 20点
 * - 活動カテゴリ: 10点
 * - ウェブサイトURL: 10点
 * - ロゴURL: 10点
 * - LINE ID: 5点
 * - LINE URL: 5点
 */
function calcProfileCompleteness(data: RegisterOrganizationData): number {
  let score = 0;
  if (data.organizationName?.trim()) score += 10;
  if (data.representativeName?.trim()) score += 10;
  if (data.contactEmail?.trim()) score += 10;
  if (data.activityAreas && data.activityAreas.length > 0) score += 10;
  if (data.description?.trim()) score += 20;
  if (data.activityCategories && data.activityCategories.length > 0) score += 10;
  if (data.websiteUrl?.trim()) score += 10;
  if (data.logoUrl?.trim()) score += 10;
  if (data.contactLineId?.trim()) score += 5;
  if (data.contactLineUrl?.trim()) score += 5;
  return score;
}

/**
 * 団体プロフィール登録 — m_organization_profile を作成/更新し、審査待ちへ
 */
export async function registerOrganization(
  data: RegisterOrganizationData
): Promise<RegisterOrganizationResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "ログインが必要です" };
    }

    // 必須フィールドのバリデーション
    if (!data.organizationName?.trim()) {
      return { success: false, error: "団体名は必須です" };
    }
    if (!data.representativeName?.trim()) {
      return { success: false, error: "代表者名は必須です" };
    }
    if (!data.contactEmail?.trim()) {
      return { success: false, error: "連絡先メールアドレスは必須です" };
    }
    if (!data.activityAreas || data.activityAreas.length === 0) {
      return { success: false, error: "活動地域を1つ以上選択してください" };
    }

    const profileCompleteness = calcProfileCompleteness(data);

    const normalizedActivityCategories =
      data.activityCategories && data.activityCategories.length > 0
        ? data.activityCategories
        : null;

    // 団体プロフィールを作成（既存の場合は更新）
    await prisma.organizationProfile.upsert({
      where: { userId: user.id },
      update: {
        organizationName: data.organizationName.trim(),
        representativeName: data.representativeName.trim(),
        contactEmail: data.contactEmail.trim(),
        activityAreas: data.activityAreas,
        description: data.description?.trim() || null,
        activityCategories: normalizedActivityCategories,
        websiteUrl: data.websiteUrl?.trim() || null,
        logoUrl: data.logoUrl?.trim() || null,
        contactLineId: data.contactLineId?.trim() || null,
        contactLineUrl: data.contactLineUrl?.trim() || null,
        profileCompleteness,
      },
      create: {
        userId: user.id,
        organizationName: data.organizationName.trim(),
        representativeName: data.representativeName.trim(),
        contactEmail: data.contactEmail.trim(),
        activityAreas: data.activityAreas,
        description: data.description?.trim() || null,
        activityCategories: normalizedActivityCategories,
        websiteUrl: data.websiteUrl?.trim() || null,
        logoUrl: data.logoUrl?.trim() || null,
        contactLineId: data.contactLineId?.trim() || null,
        contactLineUrl: data.contactLineUrl?.trim() || null,
        profileCompleteness,
      },
    });

    // オンボーディング完了フラグをセット
    await supabase.auth.updateUser({
      data: { onboarding_completed: true },
    });

    return { success: true };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[registerOrganization] 予期しないエラー:", err);
    }
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

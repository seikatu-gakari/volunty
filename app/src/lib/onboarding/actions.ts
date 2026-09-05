"use server";

import { ensureUserRecord } from "@/lib/auth/ensure-user-record";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  getParticipantRoleError,
  resolveOnboardingRole,
} from "@/lib/onboarding/role";
import type {
  RegisterParticipantData,
  RegisterParticipantResult,
  RegisterOrganizationData,
  RegisterOrganizationResult,
  SelectRoleResult,
} from "./types";

const SELECT_ROLE_ERROR = "ロールの保存中にエラーが発生しました";

/**
 * ロール選択 — user_metadata と m_user のロールを更新
 */
export async function selectRole(
  role: "participant" | "organization"
): Promise<SelectRoleResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: SELECT_ROLE_ERROR };
    }

    // Supabase Auth メタデータを更新
    const { error: authError } = await supabase.auth.updateUser({
      data: { role },
    });
    if (authError) {
      console.error("[selectRole] Auth metadata 更新エラー:", authError);
      return { success: false, error: SELECT_ROLE_ERROR };
    }

    // DB のロールも同期し、m_user 未作成環境でも進めるようにする
    await ensureUserRecord(user, { role, updateRole: true });

    return {
      success: true,
      redirectTo:
        role === "organization"
          ? "/onboarding/organization"
          : "/onboarding/participant",
    };
  } catch (error) {
    console.error("[selectRole] 予期しないエラー:", error);
    return { success: false, error: SELECT_ROLE_ERROR };
  }
}

/**
 * 参加者プロフィールを登録する
 *
 * - m_participant_profile テーブルを Prisma 経由で upsert
 * - 成功後、{ success: true } を返す（クライアント側で /diagnosis へ遷移）
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

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    const metadata = user.user_metadata as Record<string, unknown> | undefined;
    const role = resolveOnboardingRole({
      dbRole: dbUser?.role,
      metadataRole: metadata?.role,
    });

    if (role !== "participant") {
      return { success: false, error: getParticipantRoleError(role) };
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

    // m_user を保証し、ロールも参加者として同期する
    await ensureUserRecord(user, { role: "participant", updateRole: true });

    await prisma.participantProfile.upsert({
      where: { userId: user.id },
      update: {
        name: data.name.trim(),
        birthday: new Date(data.birthday),
        gender: data.gender || null,
        region: data.region,
        bio: data.bio?.trim() || null,
        lineId: data.lineId?.trim() || null,
        interests:
          data.interests && data.interests.length > 0
            ? (data.interests as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
      create: {
        userId: user.id,
        name: data.name.trim(),
        birthday: new Date(data.birthday),
        gender: data.gender || null,
        region: data.region,
        bio: data.bio?.trim() || null,
        lineId: data.lineId?.trim() || null,
        interests:
          data.interests && data.interests.length > 0
            ? (data.interests as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });

    // オンボーディング完了フラグをセット
    await supabase.auth.updateUser({
      data: { onboarding_completed: true },
    });

    return { success: true };
  } catch (err) {
    console.error("[registerParticipant] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

/**
 * 団体プロフィール充実度スコアを計算する（0-100）
 *
 * - 必須5項目（各10点）: 50点
 * - 団体説明: 20点
 * - 活動カテゴリ: 10点
 * - ウェブサイトURL: 10点
 * - ロゴURL: 10点
 */
function calcProfileCompleteness(data: RegisterOrganizationData): number {
  let score = 0;
  if (data.organizationName?.trim()) score += 10;
  if (data.representativeName?.trim()) score += 10;
  if (data.contactEmail?.trim()) score += 10;
  if (data.activityAreas && data.activityAreas.length > 0) score += 10;
  if (data.contactLineId.trim()) score += 10;
  if (data.description?.trim()) score += 20;
  if (data.activityCategories && data.activityCategories.length > 0) score += 10;
  if (data.websiteUrl?.trim()) score += 10;
  if (data.logoUrl?.trim()) score += 10;
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
    if (!data.contactLineId?.trim()) {
      return { success: false, error: "LINE公式アカウントIDは必須です" };
    }

    const profileCompleteness = calcProfileCompleteness(data);
    const normalizedContactLineId = data.contactLineId.trim();
    const normalizedContactLineUrl = data.contactLineUrl?.trim() || null;

    const normalizedActivityCategories =
      data.activityCategories && data.activityCategories.length > 0
        ? data.activityCategories
        : undefined;

    // m_user を保証し、ロールも団体として同期する
    await ensureUserRecord(user, { role: "organization", updateRole: true });

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
        contactLineId: normalizedContactLineId,
        contactLineUrl: normalizedContactLineUrl,
        reviewStatus: "pending",
        reviewComment: null,
        reviewedAt: null,
        reviewedBy: null,
        verified: false,
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
        contactLineId: normalizedContactLineId,
        contactLineUrl: normalizedContactLineUrl,
        reviewStatus: "pending",
        reviewComment: null,
        reviewedAt: null,
        reviewedBy: null,
        profileCompleteness,
      },
    });

    // オンボーディング完了フラグをセット
    await supabase.auth.updateUser({
      data: { onboarding_completed: true },
    });

    return { success: true };
  } catch (err) {
    console.error("[registerOrganization] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

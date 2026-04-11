"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type {
  RegisterParticipantData,
  RegisterParticipantResult,
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

    const { error: insertError } = await supabase.from("participants").insert({
      id: user.id,
      name: data.name,
      region: data.region || null,
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
 * 団体プロフィール登録 — m_organization_profile を作成し、審査待ちへ
 */
export async function registerOrganizationProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です");

  const organizationName = (formData.get("organizationName") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const representativeName =
    (formData.get("representativeName") as string)?.trim() || null;
  const contactLineUrl =
    (formData.get("contactLineUrl") as string)?.trim() || null;

  if (!organizationName) throw new Error("団体名は必須です");

  // 団体プロフィールを作成（既存の場合は更新）
  await prisma.organizationProfile.upsert({
    where: { userId: user.id },
    update: { organizationName, description, representativeName, contactLineUrl },
    create: {
      userId: user.id,
      organizationName,
      description,
      representativeName,
      contactLineUrl,
    },
  });

  // オンボーディング完了フラグをセット
  await supabase.auth.updateUser({
    data: { onboarding_completed: true },
  });

  redirect("/onboarding/pending");
}

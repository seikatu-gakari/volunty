"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  ParticipantFormData,
  OrganizationFormData,
  RegisterResult,
  OnboardingStatus,
  UserRole,
} from "./types";

/**
 * 参加者プロフィール登録
 *
 * - users テーブルの role を 'participant' に設定（upsert）
 * - participants テーブルにプロフィールレコードを挿入
 */
export async function registerParticipant(
  data: ParticipantFormData
): Promise<RegisterResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "ログインが必要です" };
    }

    // users テーブルにロールを保存（upsert）
    const { error: userError } = await supabase.from("users").upsert({
      id: user.id,
      email: user.email ?? "",
      role: "participant",
    });

    if (userError) {
      return { success: false, error: "ユーザー情報の更新に失敗しました" };
    }

    // participants テーブルにプロフィールを保存
    const { error: profileError } = await supabase.from("participants").upsert({
      id: user.id,
      name: data.name,
      region: data.region,
    });

    if (profileError) {
      return { success: false, error: "プロフィールの登録に失敗しました" };
    }

    return { success: true };
  } catch (err) {
    console.error("[registerParticipant] Error:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

/**
 * 団体プロフィール登録
 *
 * - users テーブルの role を 'organization' に設定（upsert）
 * - organizations テーブルにプロフィールレコードを挿入（status: 'pending'）
 */
export async function registerOrganization(
  data: OrganizationFormData
): Promise<RegisterResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "ログインが必要です" };
    }

    // users テーブルにロールを保存（upsert）
    const { error: userError } = await supabase.from("users").upsert({
      id: user.id,
      email: user.email ?? "",
      role: "organization",
    });

    if (userError) {
      return { success: false, error: "ユーザー情報の更新に失敗しました" };
    }

    // organizations テーブルにプロフィールを保存（status は 'pending' で初期化）
    const { error: profileError } = await supabase
      .from("organizations")
      .upsert({
        id: user.id,
        name: data.name,
        description: data.description,
        line_id: data.line_id,
        contact_email: data.contact_email,
        status: "pending",
      });

    if (profileError) {
      return { success: false, error: "団体情報の登録に失敗しました" };
    }

    return { success: true };
  } catch (err) {
    console.error("[registerOrganization] Error:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

/**
 * 現在のユーザーのオンボーディング状態を取得
 *
 * - 未ログイン: hasRole=false, role=null
 * - ロール未設定: hasRole=false, role=null
 * - 参加者ロール設定済み・プロフィールなし: hasRole=true, hasProfile=false
 * - 参加者ロール設定済み・プロフィールあり: hasRole=true, hasProfile=true
 * - 団体ロール設定済み: organizationStatus に審査ステータスを含む
 */
export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        hasRole: false,
        role: null,
        hasProfile: false,
        organizationStatus: null,
      };
    }

    // users テーブルからロールを取得
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userData?.role) {
      return {
        hasRole: false,
        role: null,
        hasProfile: false,
        organizationStatus: null,
      };
    }

    const rawRole = userData.role;
    if (rawRole !== "participant" && rawRole !== "organization") {
      // 無効なロール値の場合は未設定として扱う
      return {
        hasRole: false,
        role: null,
        hasProfile: false,
        organizationStatus: null,
      };
    }
    const role: UserRole = rawRole;

    if (role === "participant") {
      const { data: profile } = await supabase
        .from("participants")
        .select("id")
        .eq("id", user.id)
        .single();

      return {
        hasRole: true,
        role,
        hasProfile: !!profile,
        organizationStatus: null,
      };
    }

    if (role === "organization") {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, status")
        .eq("id", user.id)
        .single();

      return {
        hasRole: true,
        role,
        hasProfile: !!org,
        organizationStatus: org
          ? (org.status as "pending" | "approved" | "rejected")
          : null,
      };
    }

    return {
      hasRole: false,
      role: null,
      hasProfile: false,
      organizationStatus: null,
    };
  } catch {
    // テーブル未作成・接続エラー時はデフォルト値を返す
    return {
      hasRole: false,
      role: null,
      hasProfile: false,
      organizationStatus: null,
    };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  RegisterParticipantData,
  RegisterParticipantResult,
} from "./types";

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

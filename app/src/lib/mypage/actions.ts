"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAccountDeletionEnabled } from "@/lib/account-deletion/config";
import { processAccountDeletion } from "@/lib/account-deletion/orchestrator";
import { fetchMyApplicationDetailQuery } from "./queries";
import type { DeleteAccountState, ApplicationDetailResult } from "./types";

const DELETE_ACCOUNT_CONFIRMATION = "削除する";

/** ログイン中ユーザーのアカウントを物理削除する。 */
export async function deleteMyAccount(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  if (!isAccountDeletionEnabled()) {
    return { error: "現在、アカウント削除を一時停止しています。" };
  }

  if (formData.get("confirmation") !== DELETE_ACCOUNT_CONFIRMATION) {
    return { error: "確認欄に「削除する」と入力してください。" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: "ログイン状態を確認できませんでした。再ログインしてからお試しください。",
    };
  }

  let deletionStatus: "completed" | "auth_failed" | "cleanup_pending";
  try {
    const result = await processAccountDeletion(user.id);
    deletionStatus = result.status;
    if (result.status === "auth_failed") {
      return {
        error:
          "認証アカウントの削除に失敗しました。時間をおいて再度お試しください。",
      };
    }
  } catch (err) {
    console.error("[deleteMyAccount] アカウント削除処理の開始に失敗:", err);
    return {
      error: "アカウント削除に失敗しました。時間をおいて再度お試しください。",
    };
  }

  if (deletionStatus === "cleanup_pending") {
    redirect("/login?accountDeletionPending=1");
  }

  redirect("/login?accountDeleted=1");
}

/**
 * 参加者の応募詳細取得
 *
 * - ログイン中ユーザーの応募のみ返す（participantId チェックで認可）
 * - status = approved / completed の場合のみ LINE 連絡先を公開
 */
export async function fetchMyApplicationDetail(
  applicationId: string
): Promise<ApplicationDetailResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { application: null, error: "ログインが必要です" };
  }
  return fetchMyApplicationDetailQuery(user.id, applicationId);
}

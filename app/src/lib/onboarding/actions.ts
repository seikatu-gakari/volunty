"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type UserRole = "participant" | "organization";

/**
 * ログイン済みユーザーのロールを設定し、対応するオンボーディングページへリダイレクトする。
 *
 * - 未認証の場合は /login へリダイレクト
 * - DB 更新失敗時はエラーオブジェクトを返す
 * - 成功時は role に応じたオンボーディングページへリダイレクト
 */
export async function setUserRole(
  role: UserRole
): Promise<{ error: string } | void> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { error: dbError } = await supabase
    .from("users")
    .update({ role })
    .eq("id", user.id);

  if (dbError) {
    return { error: "ロールの設定に失敗しました" };
  }

  redirect(
    role === "participant" ? "/onboarding/participant" : "/onboarding/organization"
  );
}

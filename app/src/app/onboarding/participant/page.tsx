import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParticipantProfileForm } from "./components/ParticipantProfileForm";
import { fetchParticipantProfileByUserId } from "@/lib/participant-profile/server";

/** 認証状態とプロフィール登録状況を取得する */
async function getPageState(): Promise<{
  isAuthenticated: boolean;
  hasProfile: boolean;
}> {
  // 1. 認証チェック
  let user;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return { isAuthenticated: false, hasProfile: false };
  }

  if (!user) {
    return { isAuthenticated: false, hasProfile: false };
  }

  // 2. プロフィールチェック（DB エラー時は未登録扱いだが認証は true を維持）
  try {
    const profile = await fetchParticipantProfileByUserId(user.id);
    return { isAuthenticated: true, hasProfile: !!profile };
  } catch (err) {
    // DB エラーでもログイン状態は維持してフォームを表示する
    console.error("[OnboardingParticipantPage] プロフィール確認に失敗:", err);
    return { isAuthenticated: true, hasProfile: false };
  }
}

export default async function OnboardingParticipantPage() {
  const { isAuthenticated, hasProfile } = await getPageState();

  if (!isAuthenticated) redirect("/login");
  if (hasProfile) redirect("/");

  return <ParticipantProfileForm />;
}

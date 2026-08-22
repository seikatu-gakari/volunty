import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseOnboardingRole } from "@/lib/onboarding/role";
import { RoleSelectionClient } from "./RoleSelectionClient";

export default async function OnboardingRolePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 未認証の場合はログインページへ
  if (!user) {
    redirect("/login");
  }

  const { data: account, error: accountError } = await supabase
    .from("m_user")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (accountError) {
    console.error("[OnboardingRolePage] m_user照会に失敗:", accountError);
    throw new Error("m_userの照会に失敗しました");
  }

  const role = parseOnboardingRole(account?.role);

  // 管理者とプロフィール登録済みユーザーはロール選択の対象外
  if (role === "admin") {
    redirect("/");
  }

  if (!role) {
    return <RoleSelectionClient />;
  }

  const profileTable =
    role === "participant"
      ? "m_participant_profile"
      : "m_organization_profile";
  const { data: profile, error: profileError } = await supabase
    .from(profileTable)
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[OnboardingRolePage] プロフィール照会に失敗:", profileError);
    throw new Error("プロフィールの照会に失敗しました");
  }

  if (profile) {
    redirect("/");
  }

  return <RoleSelectionClient />;
}

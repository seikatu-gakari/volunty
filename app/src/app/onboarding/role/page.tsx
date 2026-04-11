import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const metadata = user.user_metadata as Record<string, unknown>;
  const role = metadata.role as string | undefined;
  const onboardingCompleted = metadata.onboarding_completed as boolean | undefined;

  // オンボーディング完了済みの場合はトップページへ
  if (onboardingCompleted) {
    redirect("/");
  }

  // 既にロール設定済みの場合は次のオンボーディングステップへ
  if (role === "participant") {
    redirect("/onboarding/participant");
  }
  if (role === "organization") {
    redirect("/onboarding/organization");
  }

  return <RoleSelectionClient />;
}

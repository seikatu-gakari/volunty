import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrganizationForm } from "./components/OrganizationForm";
import { fetchOnboardingStatus } from "@/lib/onboarding/actions";

export default async function OrganizationOnboardingPage() {
  // 認証チェック
  let isAuthenticated = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    isAuthenticated = !!data.user;
  } catch {
    // Supabase 未設定時
  }

  if (!isAuthenticated) {
    redirect("/login");
  }

  // オンボーディング状態チェック
  const status = await fetchOnboardingStatus();

  // 参加者ロールのユーザーがアクセスした場合はリダイレクト
  if (status.hasRole && status.role === "participant") {
    if (status.hasProfile) {
      redirect("/");
    } else {
      redirect("/onboarding/participant");
    }
  }

  // すでに団体プロフィールが登録済みの場合はリダイレクト
  if (status.hasRole && status.role === "organization" && status.hasProfile) {
    if (status.organizationStatus !== "approved") {
      redirect("/onboarding/pending");
    } else {
      redirect("/");
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <OrganizationForm />
    </div>
  );
}

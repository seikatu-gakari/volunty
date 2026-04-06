import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParticipantForm } from "./components/ParticipantForm";
import { fetchOnboardingStatus } from "@/lib/onboarding/actions";

export default async function ParticipantOnboardingPage() {
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

  // 団体ロールのユーザーがアクセスした場合はリダイレクト
  if (status.hasRole && status.role === "organization") {
    if (!status.hasProfile) {
      redirect("/onboarding/organization");
    } else if (status.organizationStatus !== "approved") {
      redirect("/onboarding/pending");
    } else {
      redirect("/");
    }
  }

  // すでに参加者プロフィールが登録済みの場合はホームへリダイレクト
  if (status.hasRole && status.role === "participant" && status.hasProfile) {
    redirect("/");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <ParticipantForm />
    </div>
  );
}

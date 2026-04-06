import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/components/Header";
import { ParticipantProfileForm } from "./components/ParticipantProfileForm";

export default async function OnboardingParticipantPage() {
  let isAuthenticated = false;
  let hasProfile = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;

      // プロフィール登録済みチェック
      const { data: profile } = await supabase
        .from("participants")
        .select("id")
        .eq("id", user.id)
        .single();

      hasProfile = !!profile;
    }
  } catch {
    // Supabase 未設定時はスキップ
  }

  if (!isAuthenticated) redirect("/login");
  if (hasProfile) redirect("/");

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <ParticipantProfileForm />
    </div>
  );
}

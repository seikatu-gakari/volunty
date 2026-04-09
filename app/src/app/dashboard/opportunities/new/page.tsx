import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { createClient } from "@/lib/supabase/server";
import { OpportunityForm } from "./components/OpportunityForm";

export default async function NewOpportunityPage() {
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

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <OpportunityForm />
      </main>
    </div>
  );
}

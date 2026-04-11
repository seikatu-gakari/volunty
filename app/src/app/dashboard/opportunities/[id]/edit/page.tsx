import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Header } from "@/app/components/Header";
import { createClient } from "@/lib/supabase/server";
import { fetchOpportunityForEdit } from "@/lib/dashboard/actions";
import { EditFormWrapper } from "./components/EditFormWrapper";

export default async function EditOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  // 案件データの取得（自団体の案件のみ）
  const { opportunity } = await fetchOpportunityForEdit(id);

  // 案件が存在しない or 他団体の案件の場合は 404
  if (!opportunity) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <EditFormWrapper
          opportunityId={opportunity.id}
          initialData={{
            title: opportunity.title,
            description: opportunity.description,
            required_traits: opportunity.required_traits,
            status: opportunity.status,
          }}
        />
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { createClient } from "@/lib/supabase/server";
import { fetchOpportunityForEdit } from "@/lib/dashboard/actions";
import { OpportunityForm_New } from "./components/OpportunityForm";

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams?: Promise<{ copyFrom?: string | string[] }>;
}) {
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

  const params = await searchParams;
  const copyFrom = Array.isArray(params?.copyFrom)
    ? params?.copyFrom[0]
    : params?.copyFrom;
  const copied = copyFrom
    ? (await fetchOpportunityForEdit(copyFrom)).opportunity
    : null;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <OpportunityForm_New
          initialData={
            copied
              ? {
                  title: `${copied.title}（コピー）`,
                  description: copied.description,
                  activity_style_tags: copied.activity_style_tags,
                  required_qualifications: copied.required_qualifications,
                  min_age: copied.min_age,
                  max_age: copied.max_age,
                  status: "draft",
                  location: copied.location,
                  start_date: copied.start_date,
                  end_date: copied.end_date,
                  capacity: copied.capacity,
                  category: copied.category,
                  participation_mode: copied.participation_mode,
                }
              : undefined
          }
        />
      </main>
    </div>
  );
}

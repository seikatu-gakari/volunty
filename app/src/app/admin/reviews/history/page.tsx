import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { Header } from "@/app/components/Header";
import { ReviewHistoryList } from "@/app/admin/reviews/history/ReviewHistoryList";
import { fetchReviewHistory } from "@/lib/admin/actions";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export default async function AdminReviewHistoryPage() {
  // 管理者チェック
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!dbUser || dbUser.role !== "admin") {
    redirect("/forbidden");
  }

  const history = await fetchReviewHistory();

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Shield className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-dark">審査履歴</h1>
            <p className="text-sm text-text-body">
              過去の承認・却下の履歴を確認できます
            </p>
          </div>
        </div>

        <ReviewHistoryList entries={history} />
      </main>
    </div>
  );
}

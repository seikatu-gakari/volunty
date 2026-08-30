import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { Header } from "@/app/components/Header";
import { ReviewHistoryList } from "@/app/admin/reviews/history/ReviewHistoryList";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { fetchReviewHistoryQuery } from "@/lib/admin/queries";

export default async function AdminReviewHistoryPage() {
  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive || viewer.role !== "admin") {
    redirect("/forbidden");
  }

  const history = await fetchReviewHistoryQuery();

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />
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

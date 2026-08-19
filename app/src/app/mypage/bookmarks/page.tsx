import Link from "next/link";
import { ArrowLeft, Bookmark, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchMyBookmarks } from "@/lib/bookmarks/actions";
import { RemoveBookmarkButton } from "./RemoveBookmarkButton";

export default async function MyBookmarksPage() {
  const { bookmarks, error } = await fetchMyBookmarks();

  if (error === "ログインが必要です") {
    redirect("/login");
  }
  if (error === "参加者登録が必要です") {
    redirect("/onboarding/participant");
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/mypage"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          マイページに戻る
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Bookmark className="size-5 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-text-dark">
                後で見る案件
              </h1>
            </div>
          </CardHeader>
          <CardContent>
            {bookmarks.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-body">
                後で見る案件はまだありません。
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-card-border">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="flex items-center justify-between gap-4 py-4"
                  >
                    <Link
                      href={`/opportunities/${bookmark.id}`}
                      className="flex min-w-0 flex-1 items-center gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-bold text-text-dark">
                          {bookmark.title}
                        </h2>
                        <p className="mt-1 text-xs text-text-body">
                          {bookmark.organizationName}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-text-body" />
                    </Link>
                    <RemoveBookmarkButton opportunityId={bookmark.id} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

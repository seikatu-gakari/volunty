import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchMyBookmarks } from "@/lib/bookmarks/actions";
import { BookmarkList } from "./BookmarkList";

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
            <BookmarkList bookmarks={bookmarks} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

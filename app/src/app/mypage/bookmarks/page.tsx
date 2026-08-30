import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { fetchMyBookmarks } from "@/lib/bookmarks/queries";
import { BookmarkList } from "./BookmarkList";

export default async function MyBookmarksPage() {
  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") throw new Error("閲覧者情報を確認できませんでした");
  if (
    !viewer.isActive ||
    viewer.role !== "participant" ||
    !viewer.hasParticipantProfile
  ) redirect("/onboarding/participant");
  const { bookmarks } = await fetchMyBookmarks(viewer.identity.id);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />
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
            <BookmarkList initialBookmarks={bookmarks} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

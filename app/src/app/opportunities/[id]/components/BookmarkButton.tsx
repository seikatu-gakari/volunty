"use client";

import { useState, useTransition } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { addBookmark, removeBookmark } from "@/lib/bookmarks/actions";

export function BookmarkButton({
  opportunityId,
  initialBookmarked = false,
  onToggled,
}: {
  opportunityId: string;
  initialBookmarked?: boolean;
  onToggled?: (bookmarked: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = bookmarked
        ? await removeBookmark(opportunityId)
        : await addBookmark(opportunityId);
      if (!result.success) {
        setMessage(result.error ?? "お気に入りを更新できませんでした");
        return;
      }
      setBookmarked(!bookmarked);
      setMessage(
        bookmarked
          ? "後で見るから外しました"
          : "お気に入りに追加しました"
      );
      onToggled?.(!bookmarked);
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={bookmarked}
        className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm font-medium text-text-dark hover:bg-background disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bookmark
            className={`size-4 ${bookmarked ? "fill-primary text-primary" : ""}`}
          />
        )}
        {bookmarked ? "リストから外す" : "後で見る"}
      </button>
      {message && <p className="text-xs text-text-body">{message}</p>}
    </div>
  );
}

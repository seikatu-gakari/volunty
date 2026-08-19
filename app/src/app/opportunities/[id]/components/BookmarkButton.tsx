"use client";

import { useState, useTransition } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { addBookmark, removeBookmark } from "@/lib/bookmarks/actions";

interface BookmarkButtonProps {
  opportunityId: string;
  initialBookmarked?: boolean;
}

export function BookmarkButton({
  opportunityId,
  initialBookmarked = false,
}: BookmarkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    const next = !bookmarked;
    setBookmarked(next);

    startTransition(async () => {
      const result = next
        ? await addBookmark(opportunityId)
        : await removeBookmark(opportunityId);

      if (result.success) {
        setMessage(next ? "お気に入りに追加しました" : "後で見るから外しました");
      } else {
        setBookmarked(!next);
        setMessage(result.error ?? "操作に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={bookmarked}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
          bookmarked
            ? "border-primary bg-primary/10 text-primary"
            : "border-card-border bg-white text-text-dark hover:bg-background"
        }`}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bookmark
            className={`size-4 ${bookmarked ? "fill-primary" : ""}`}
          />
        )}
        {bookmarked ? "保存済み" : "後で見る"}
      </button>
      {message && <p className="text-xs text-text-body">{message}</p>}
    </div>
  );
}

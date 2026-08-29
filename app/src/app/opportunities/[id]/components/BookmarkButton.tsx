"use client";

import { useState, useTransition } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { addBookmark, removeBookmark } from "@/lib/bookmarks/actions";

interface BookmarkButtonProps {
  opportunityId: string;
  initialBookmarked?: boolean;
  onBookmarkedChange?: (isBookmarked: boolean) => void;
}

export function BookmarkButton({
  opportunityId,
  initialBookmarked = false,
  onBookmarkedChange,
}: BookmarkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const nextBookmarked = !isBookmarked;
      const result = nextBookmarked
        ? await addBookmark(opportunityId)
        : await removeBookmark(opportunityId);
      if (result.success) {
        setIsBookmarked(nextBookmarked);
        setMessage(
          nextBookmarked
            ? "お気に入りに追加しました"
            : "お気に入りを解除しました"
        );
        onBookmarkedChange?.(nextBookmarked);
        return;
      }
      setMessage(
        result.error ??
          (nextBookmarked
            ? "お気に入りに追加できませんでした"
            : "お気に入りを解除できませんでした")
      );
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={isBookmarked}
        className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm font-medium text-text-dark hover:bg-background disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bookmark
            className="size-4"
            fill={isBookmarked ? "currentColor" : "none"}
          />
        )}
        {isBookmarked ? "後で見るから解除" : "後で見る"}
      </button>
      {message && <p className="text-xs text-text-body">{message}</p>}
    </div>
  );
}

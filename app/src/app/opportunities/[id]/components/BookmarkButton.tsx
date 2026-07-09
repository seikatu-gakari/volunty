"use client";

import { useState, useTransition } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { addBookmark } from "@/lib/bookmarks/actions";

export function BookmarkButton({ opportunityId }: { opportunityId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await addBookmark(opportunityId);
      setMessage(
        result.success
          ? "お気に入りに追加しました"
          : (result.error ?? "お気に入りに追加できませんでした")
      );
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm font-medium text-text-dark hover:bg-background disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bookmark className="size-4" />
        )}
        後で見る
      </button>
      {message && <p className="text-xs text-text-body">{message}</p>}
    </div>
  );
}

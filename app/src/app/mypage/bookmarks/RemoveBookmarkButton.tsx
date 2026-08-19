"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { removeBookmark } from "@/lib/bookmarks/actions";

interface RemoveBookmarkButtonProps {
  opportunityId: string;
}

export function RemoveBookmarkButton({
  opportunityId,
}: RemoveBookmarkButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeBookmark(opportunityId);
      if (result.success) {
        router.refresh();
        return;
      }
      setError(result.error ?? "解除に失敗しました");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-lg border border-card-border px-2.5 py-1.5 text-xs font-medium text-text-body transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <X className="size-3.5" />
        )}
        リストから外す
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

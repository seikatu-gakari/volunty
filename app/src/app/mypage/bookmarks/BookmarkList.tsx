"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BookmarkButton } from "@/app/opportunities/[id]/components/BookmarkButton";
import type { BookmarkItem } from "@/lib/bookmarks/actions";

export function BookmarkList({ bookmarks }: { bookmarks: BookmarkItem[] }) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const visible = bookmarks.filter((bookmark) => !hiddenIds.includes(bookmark.id));

  if (visible.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-body">
        後で見る案件はまだありません。
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-card-border">
      {visible.map((bookmark) => (
        <div
          key={bookmark.id}
          className="flex items-center justify-between gap-4 py-4"
        >
          <Link
            href={`/opportunities/${bookmark.id}`}
            className="flex min-w-0 flex-1 items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-text-dark">
                {bookmark.title}
              </h2>
              <p className="mt-1 text-xs text-text-body">
                {bookmark.organizationName}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-text-body" />
          </Link>
          <BookmarkButton
            opportunityId={bookmark.id}
            initialBookmarked
            onToggled={(bookmarked) => {
              if (!bookmarked) {
                setHiddenIds((current) => [...current, bookmark.id]);
              }
            }}
          />
        </div>
      ))}
    </div>
  );
}

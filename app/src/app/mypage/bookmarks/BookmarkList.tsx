"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { BookmarkItem } from "@/lib/bookmarks/actions";
import { BookmarkButton } from "@/app/opportunities/[id]/components/BookmarkButton";

export function BookmarkList({
  initialBookmarks,
}: {
  initialBookmarks: BookmarkItem[];
}) {
  const [bookmarks, setBookmarks] = useState(initialBookmarks);

  if (bookmarks.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-body">
        後で見る案件はまだありません。
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-card-border">
      {bookmarks.map((bookmark) => (
        <div key={bookmark.id} className="flex items-center gap-4 py-4">
          <Link
            href={`/opportunities/${bookmark.id}`}
            className="flex min-w-0 flex-1 items-center justify-between gap-4"
          >
            <div>
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
            onBookmarkedChange={(isBookmarked) => {
              if (!isBookmarked) {
                setBookmarks((current) =>
                  current.filter(({ id }) => id !== bookmark.id)
                );
              }
            }}
          />
        </div>
      ))}
    </div>
  );
}

"use client";

import { LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";

export function HeaderNavigationPendingIndicator() {
  const { pending } = useLinkStatus();

  if (!pending) {
    return null;
  }

  return (
    <span
      aria-label="ページを読み込み中"
      className="inline-flex items-center"
      role="status"
    >
      <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
    </span>
  );
}

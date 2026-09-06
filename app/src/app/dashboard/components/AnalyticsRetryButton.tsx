"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

interface AnalyticsRetryButtonProps {
  isSuccessful: boolean;
  headingId: string;
}

export default function AnalyticsRetryButton({
  isSuccessful,
  headingId,
}: AnalyticsRetryButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasRetried = useRef(false);
  const retryInProgress = useRef(false);
  const wasSuccessful = useRef(isSuccessful);

  useEffect(() => {
    if (!wasSuccessful.current && isSuccessful && hasRetried.current) {
      document.getElementById(headingId)?.focus();
    }

    wasSuccessful.current = isSuccessful;
    if (isSuccessful) {
      retryInProgress.current = false;
    }
  }, [headingId, isPending, isSuccessful]);

  if (isSuccessful) {
    return null;
  }

  const handleRetry = () => {
    if (isPending || retryInProgress.current) {
      return;
    }

    hasRetried.current = true;
    retryInProgress.current = true;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      aria-busy={isPending}
      aria-live="polite"
    >
      <button
        type="button"
        onClick={handleRetry}
        disabled={isPending}
        className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "再取得中…" : "分析を再試行"}
      </button>
    </div>
  );
}

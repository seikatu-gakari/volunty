"use client";

import Link from "next/link";
import { Home, RefreshCw, TriangleAlert } from "lucide-react";

interface RetryActionButtonProps {
  label?: string;
  onRetry: () => void;
}

export interface CommonErrorDisplayProps {
  title?: string;
  description?: string;
  retryLabel?: string;
  homeHref?: string;
  homeLabel?: string;
  digest?: string;
  onRetry?: () => void;
  className?: string;
}

export function RetryActionButton({
  label = "もう一度試す",
  onRetry,
}: RetryActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-background transition-colors hover:bg-primary-dark"
    >
      <RefreshCw className="size-4" aria-hidden />
      {label}
    </button>
  );
}

export function CommonErrorDisplay({
  title = "ページを読み込めませんでした",
  description = "一時的な問題が発生した可能性があります。もう一度お試しください。",
  retryLabel,
  homeHref = "/",
  homeLabel = "トップへ戻る",
  digest,
  onRetry,
  className = "",
}: CommonErrorDisplayProps) {
  return (
    <main
      role="alert"
      aria-labelledby="common-error-title"
      aria-describedby="common-error-description"
      className={`mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center ${className}`}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <TriangleAlert className="size-8" aria-hidden />
      </div>

      <p className="mt-6 text-sm font-semibold text-primary">
        エラーが発生しました
      </p>
      <h1
        id="common-error-title"
        className="mt-3 text-3xl font-bold text-text-dark sm:text-4xl"
      >
        {title}
      </h1>
      <p
        id="common-error-description"
        className="mt-4 max-w-xl text-sm leading-6 text-text-body sm:text-base sm:leading-7"
      >
        {description}
      </p>

      {digest && (
        <p className="mt-3 text-xs font-medium text-text-body">
          エラーID: {digest}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {onRetry && (
          <RetryActionButton label={retryLabel} onRetry={onRetry} />
        )}
        <Link
          href={homeHref}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-card-border bg-background px-4 text-sm font-medium text-text-dark transition-colors hover:bg-tab-bg"
        >
          <Home className="size-4" aria-hidden />
          {homeLabel}
        </Link>
      </div>
    </main>
  );
}

"use client";

import { RouteErrorBoundary } from "@/app/components/ui/RouteErrorBoundary";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary error={error} reset={reset} screenName="おすすめ案件" />
  );
}

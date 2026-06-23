"use client";

import { useEffect } from "react";
import { CommonErrorDisplay } from "@/app/components/ui/CommonErrorDisplay";

export interface RouteErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
  screenName: string;
}

export function RouteErrorBoundary({
  error,
  reset,
  screenName,
}: RouteErrorBoundaryProps) {
  useEffect(() => {
    console.error(`[${screenName}] route error:`, error);
  }, [error, screenName]);

  return (
    <CommonErrorDisplay
      title={`${screenName}を読み込めませんでした`}
      digest={error.digest}
      onRetry={reset}
    />
  );
}

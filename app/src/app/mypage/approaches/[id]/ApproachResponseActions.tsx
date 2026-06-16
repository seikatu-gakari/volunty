"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { respondToApproach } from "@/lib/approaches/actions";
import type { ApproachResponse } from "@/lib/approaches/types";

interface ApproachResponseActionsProps {
  approachId: string;
}

export function ApproachResponseActions({
  approachId,
}: ApproachResponseActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleResponse(response: ApproachResponse) {
    setError(null);
    startTransition(async () => {
      const result = await respondToApproach(approachId, response);
      if (result.success) {
        router.refresh();
        return;
      }
      setError(result.error ?? "回答の送信に失敗しました");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => handleResponse("accepted")}
          disabled={isPending}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          承諾する
        </button>
        <button
          type="button"
          onClick={() => handleResponse("declined")}
          disabled={isPending}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <XCircle className="size-4" />
          )}
          辞退する
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

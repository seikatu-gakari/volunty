"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { updateApplicationStatus } from "@/lib/dashboard/actions";

interface StatusActionsProps {
  /** 応募ID */
  applicationId: string;
  /** 現在のステータス */
  currentStatus: "pending" | "approved" | "rejected";
}

/** ステータスに応じたバッジ表示 */
function statusBadge(status: "pending" | "approved" | "rejected") {
  switch (status) {
    case "pending":
      return {
        label: "審査中",
        color: "text-yellow-700 bg-yellow-50 border-yellow-200",
      };
    case "approved":
      return {
        label: "承認済み",
        color: "text-green-700 bg-green-50 border-green-200",
      };
    case "rejected":
      return {
        label: "辞退済み",
        color: "text-red-700 bg-red-50 border-red-200",
      };
  }
}

/**
 * 応募ステータスの承認/辞退ボタン（Client Component）
 *
 * - pending の場合: 承認・辞退ボタンを表示
 * - approved / rejected の場合: ステータスバッジを表示
 */
export function StatusActions({
  applicationId,
  currentStatus,
}: StatusActionsProps) {
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAction(newStatus: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result = await updateApplicationStatus(applicationId, newStatus);
      if (result.success) {
        setStatus(newStatus);
      } else {
        setError(result.error ?? "エラーが発生しました");
      }
    });
  }

  // 更新済みの場合はバッジ表示
  if (status !== "pending") {
    const badge = statusBadge(status);
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${badge.color}`}
      >
        {status === "approved" ? (
          <CheckCircle2 className="size-3.5" />
        ) : (
          <XCircle className="size-3.5" />
        )}
        {badge.label}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => handleAction("approved")}
          disabled={isPending}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          承認する
        </button>
        <button
          onClick={() => handleAction("rejected")}
          disabled={isPending}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <XCircle className="size-3.5" />
          )}
          辞退する
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

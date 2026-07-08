"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { bulkCompleteApplications } from "@/lib/dashboard/actions";
import type { Applicant } from "@/lib/dashboard/types";

interface BulkCompleteActionsProps {
  opportunityId: string;
  applicants: Applicant[];
}

export function BulkCompleteActions({
  opportunityId,
  applicants,
}: BulkCompleteActionsProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const completableApplicants = applicants.filter(
    (applicant) => applicant.status === "approved"
  );

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    );
    setMessage(null);
  }

  function handleSubmit() {
    setMessage(null);
    startTransition(async () => {
      const result = await bulkCompleteApplications(opportunityId, selectedIds);
      if (result.success) {
        setSelectedIds([]);
        setMessage(`${result.completedCount}件を活動完了にしました`);
        router.refresh();
      } else {
        setMessage(result.error ?? "活動完了にできませんでした");
      }
    });
  }

  if (completableApplicants.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-card-border bg-background/60 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-text-dark">
          活動完了の一括操作
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || selectedIds.length === 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          選択した応募を完了
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {completableApplicants.map((applicant) => (
          <label
            key={applicant.id}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-text-dark"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(applicant.id)}
              onChange={() => toggle(applicant.id)}
              className="accent-primary"
            />
            {applicant.participant_name}
          </label>
        ))}
      </div>
      {message && <p className="mt-3 text-xs text-text-body">{message}</p>}
    </div>
  );
}

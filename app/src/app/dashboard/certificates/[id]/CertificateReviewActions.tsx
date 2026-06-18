"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  approveCertificate,
  rejectCertificate,
} from "@/lib/certificates/actions";

export function CertificateReviewActions({
  certificateId,
}: {
  certificateId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await approveCertificate(certificateId);
      if (result.success) {
        setMessage("証明書を発行しました");
      } else {
        setError(result.error ?? "承認に失敗しました");
      }
    });
  }

  function handleReject() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await rejectCertificate(certificateId, reason);
      if (result.success) {
        setMessage("申請を却下しました");
      } else {
        setError(result.error ?? "却下に失敗しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        承認して発行する
      </button>

      <div className="flex flex-col gap-2">
        <label htmlFor="rejection-reason" className="text-sm font-medium text-text-dark">
          却下理由
        </label>
        <textarea
          id="rejection-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          disabled={isPending}
          placeholder="参加実績を確認できない理由などを入力してください"
          className="w-full resize-none rounded-lg border border-input-border bg-white px-4 py-3 text-sm text-text-dark placeholder:text-text-body/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={handleReject}
          disabled={isPending}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <XCircle className="size-4" />
          )}
          却下する
        </button>
      </div>

      {message && <p className="text-sm font-medium text-green-700">{message}</p>}
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}

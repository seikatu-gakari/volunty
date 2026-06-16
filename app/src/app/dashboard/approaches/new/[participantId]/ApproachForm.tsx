"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { APPROACH_MESSAGE_MAX_LENGTH } from "@/lib/approaches/constants";
import { sendApproach } from "@/lib/approaches/actions";
import type { ApproachOpportunityOption } from "@/lib/approaches/types";

interface ApproachFormProps {
  participantProfileId: string;
  opportunities: ApproachOpportunityOption[];
}

export function ApproachForm({
  participantProfileId,
  opportunities,
}: ApproachFormProps) {
  const firstAvailable = opportunities.find(
    (opportunity) => !opportunity.alreadyApproached
  );
  const [opportunityId, setOpportunityId] = useState(firstAvailable?.id ?? "");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    approachId?: string;
    error?: string;
  } | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);

    startTransition(async () => {
      const response = await sendApproach({
        participantProfileId,
        opportunityId,
        message,
      });
      setResult(response);
    });
  }

  if (result?.success) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg bg-green-50 p-6 text-center">
        <CheckCircle2 className="size-10 text-green-700" />
        <div>
          <p className="text-sm font-medium text-green-800">
            アプローチを送信しました。
          </p>
          <p className="mt-1 text-xs text-green-700">
            参加者が承諾すると、連絡先情報が表示されます。
          </p>
        </div>
        <Link
          href="/dashboard/approaches"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
        >
          送信履歴を見る
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="approach-opportunity"
          className="text-sm font-medium text-text-dark"
        >
          関連する募集案件
        </label>
        <select
          id="approach-opportunity"
          value={opportunityId}
          onChange={(event) => setOpportunityId(event.target.value)}
          disabled={isPending || !firstAvailable}
          className="h-11 rounded-lg border border-input-border bg-white px-3 text-sm text-text-dark outline-none transition-colors focus:border-primary"
        >
          {!firstAvailable && (
            <option value="">送信可能な公開中案件がありません</option>
          )}
          {opportunities.map((opportunity) => (
            <option
              key={opportunity.id}
              value={opportunity.id}
              disabled={opportunity.alreadyApproached}
            >
              {opportunity.title}
              {opportunity.alreadyApproached ? "（送信済み）" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="approach-message"
          className="text-sm font-medium text-text-dark"
        >
          アプローチ文
        </label>
        <textarea
          id="approach-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="活動内容や参加してほしい理由を入力してください"
          rows={6}
          maxLength={APPROACH_MESSAGE_MAX_LENGTH}
          disabled={isPending || !firstAvailable}
          className="w-full resize-none rounded-lg border border-input-border bg-white px-4 py-3 text-sm text-text-dark placeholder:text-text-body/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        />
        <div className="flex justify-end text-xs text-text-body">
          {message.length}/{APPROACH_MESSAGE_MAX_LENGTH}
        </div>
      </div>

      <div className="rounded-lg bg-background p-4 text-xs leading-6 text-text-body">
        アプリ内でメッセージのやり取りはできません。承諾後にLINE等で連絡します。
        参加者がアプローチを承諾するまで、団体の連絡先は参加者に表示されません。
      </div>

      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}

      <button
        type="submit"
        disabled={isPending || !firstAvailable}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            送信中...
          </>
        ) : (
          <>
            <Send className="size-4" />
            アプローチを送信
          </>
        )}
      </button>
    </form>
  );
}

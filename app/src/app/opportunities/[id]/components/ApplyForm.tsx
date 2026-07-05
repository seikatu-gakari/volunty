"use client";

import { useState, useTransition } from "react";
import { Send, CheckCircle2, Loader2 } from "lucide-react";
import { applyToOpportunity } from "@/lib/opportunities/actions";

interface ApplyFormProps {
  opportunityId: string;
  /** どの推薦から応募に至ったかの追跡用（推薦一覧経由の場合のみ） */
  recommendationLogId?: string | null;
}

/**
 * 応募フォーム（Client Component）
 *
 * - テキストエリアで応募メッセージを入力
 * - 「応募する」ボタンで応募を送信
 * - 送信中・送信完了・エラーの状態を管理
 */
export function ApplyForm({ opportunityId, recommendationLogId }: ApplyFormProps) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const res = await applyToOpportunity(
        opportunityId,
        message,
        recommendationLogId ?? null
      );
      setResult(res);
    });
  }

  // 応募成功後の表示
  if (result?.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg bg-green-50 p-6 text-center">
        <CheckCircle2 className="size-10 text-green-600" />
        <p className="text-sm font-medium text-green-800">
          応募が完了しました！団体からの連絡をお待ちください。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label
        htmlFor="apply-message"
        className="text-sm font-medium text-text-dark"
      >
        応募メッセージ
      </label>
      <textarea
        id="apply-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="自己紹介や参加動機を入力してください（任意）"
        rows={4}
        className="w-full resize-none rounded-lg border border-input-border bg-white px-4 py-3 text-sm text-text-dark placeholder:text-text-body/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
        disabled={isPending}
      />

      {/* エラー表示 */}
      {result?.error && (
        <p className="text-sm text-red-600">{result.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
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
            応募する
          </>
        )}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ui/ToastProvider";
import { deleteMyAccount } from "@/lib/mypage/actions";
import type { DeleteAccountState } from "@/lib/mypage/types";

const initialState: DeleteAccountState = {
  error: null,
};

const CONFIRMATION_TEXT = "削除する";

export function DeleteAccountForm({ enabled }: { enabled: boolean }) {
  const [state, formAction, isPending] = useActionState(
    deleteMyAccount,
    initialState
  );
  const { showToast } = useToast();

  useEffect(() => {
    if (!state.error) return;

    showToast({
      type: "error",
      title: "アカウント削除に失敗しました",
      description: state.error,
    });
  }, [showToast, state.error]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800">
          <AlertTriangle className="size-4" />
          この操作は取り消せません
        </div>
        <p className="text-sm leading-6 text-red-900">
          {enabled
            ? "アカウント、プロフィール、診断結果、応募履歴を物理削除します。"
            : "現在、アカウント削除を一時停止しています。"}
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-text-dark">
          確認のため「{CONFIRMATION_TEXT}」と入力してください
        </span>
        <input
          name="confirmation"
          type="text"
          autoComplete="off"
          required
          disabled={!enabled}
          className="h-11 rounded-lg border border-card-border bg-white px-3 text-sm text-text-dark outline-none transition-colors focus:border-primary"
        />
      </label>

      {state.error && (
        <p className="text-sm font-medium text-red-700">{state.error}</p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="outline"
          icon={Trash2}
          disabled={isPending || !enabled}
          className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
        >
          {isPending
            ? "削除中..."
            : enabled
              ? "アカウントを削除"
              : "現在利用できません"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import type { AdminUserListItem } from "@/lib/admin/actions";
import { reactivateUser, suspendUser } from "@/lib/admin/actions";

interface Props {
  user: AdminUserListItem;
}

export function UserSuspensionControl({ user }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (user.role === "admin") {
    return null;
  }

  const normalizedReason = reason.trim();

  const handleSuspend = () => {
    if (!normalizedReason) {
      setFeedback("凍結理由を入力してください");
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const result = await suspendUser(user.id, normalizedReason);
      if (result.success) {
        setIsOpen(false);
        setReason("");
        router.refresh();
        return;
      }
      setFeedback(result.error ?? "凍結に失敗しました");
    });
  };

  const handleReactivate = () => {
    startTransition(async () => {
      setFeedback(null);
      const result = await reactivateUser(user.id);
      if (result.success) {
        router.refresh();
        return;
      }
      setFeedback(result.error ?? "凍結解除に失敗しました");
    });
  };

  if (!user.isActive) {
    return (
      <div className="flex flex-col gap-2 border-t border-card-border pt-3">
        {user.suspendReason && (
          <p className="text-xs text-text-body">
            凍結理由:{" "}
            <span className="text-text-dark">{user.suspendReason}</span>
          </p>
        )}
        {feedback && <p className="text-sm text-red-700">{feedback}</p>}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            icon={RotateCcw}
            onClick={handleReactivate}
            disabled={isPending}
          >
            {isPending ? "処理中..." : "凍結を解除"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-card-border pt-3">
      {isOpen && (
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          placeholder="凍結理由を入力してください"
          className="w-full rounded-lg border border-input-border bg-white px-3 py-2 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}
      {feedback && <p className="text-sm text-red-700">{feedback}</p>}
      <div className="flex justify-end gap-2">
        {isOpen ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                setReason("");
                setFeedback(null);
              }}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Ban}
              onClick={handleSuspend}
              disabled={isPending || !normalizedReason}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              {isPending ? "処理中..." : "凍結を確定"}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            icon={Ban}
            onClick={() => setIsOpen(true)}
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            凍結する
          </Button>
        )}
      </div>
    </div>
  );
}

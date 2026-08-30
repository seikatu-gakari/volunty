import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import {
  retryPendingAccountDeletion,
  type PendingAccountDeletion,
} from "@/lib/admin/actions";

export function PendingAccountDeletions({
  requests,
}: {
  requests: PendingAccountDeletion[];
}) {
  if (requests.length === 0) return null;

  return (
    <section className="mb-8 rounded-lg border border-warning-border bg-warning-bg p-4">
      <div className="mb-4 flex items-center gap-2 text-warning">
        <AlertTriangle className="size-5" />
        <h2 className="font-bold">削除処理保留（{requests.length}件）</h2>
      </div>
      <div className="flex flex-col gap-3">
        {requests.map((request) => (
          <div
            key={request.userId}
            className="flex flex-col gap-3 rounded-lg border border-card-border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm text-text-body">
              <p className="font-medium text-text-dark">
                {request.displayName ?? "ユーザー情報削除済み"}
              </p>
              <p>受付: {new Date(request.createdAt).toLocaleString("ja-JP")}</p>
              <p>
                試行: {request.attemptCount}回 / エラー: {request.lastErrorCode ?? "なし"}
              </p>
            </div>
            <form action={retryPendingAccountDeletion}>
              <input type="hidden" name="userId" value={request.userId} />
              <Button type="submit" variant="outline" icon={RotateCw}>
                再処理
              </Button>
            </form>
          </div>
        ))}
      </div>
    </section>
  );
}

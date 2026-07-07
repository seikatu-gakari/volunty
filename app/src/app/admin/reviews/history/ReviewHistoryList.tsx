import {
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  UserRound,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import type { ReviewHistoryEntry } from "@/lib/admin/actions";

interface Props {
  entries: ReviewHistoryEntry[];
}

function getStatusView(status: ReviewHistoryEntry["reviewStatus"]) {
  if (status === "approved") {
    return {
      icon: CheckCircle2,
      label: "承認済み",
      chipClass: "border-green-200 bg-green-50 text-green-700",
      iconClass: "text-green-600",
      avatarClass: "bg-green-50",
    };
  }

  return {
    icon: XCircle,
    label: "否認済み",
    chipClass: "border-red-200 bg-red-50 text-red-700",
    iconClass: "text-red-600",
    avatarClass: "bg-red-50",
  };
}

function formatReviewedAt(reviewedAt: string) {
  return new Date(reviewedAt).toLocaleString("ja-JP");
}

export function ReviewHistoryList({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <FileText className="size-10 text-text-body/30" />
        <p className="text-sm text-text-body">審査履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => {
        const statusView = getStatusView(entry.reviewStatus);
        const StatusIcon = statusView.icon;

        return (
          <Card
            key={entry.id}
            role="article"
            aria-label={`${entry.organizationName}（${statusView.label}）`}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-full ${statusView.avatarClass}`}
                  >
                    <Building2 className={`size-5 ${statusView.iconClass}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text-dark">
                      {entry.organizationName}
                    </h3>
                    <p className="text-xs text-text-body">
                      審査日: {formatReviewedAt(entry.reviewedAt)}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusView.chipClass}`}
                >
                  <StatusIcon className="size-3.5" />
                  {statusView.label}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="size-4 shrink-0 text-text-body/60" />
                  <span className="text-text-body">審査日時:</span>
                  <span className="font-medium text-text-dark">
                    {formatReviewedAt(entry.reviewedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <UserRound className="size-4 shrink-0 text-text-body/60" />
                  <span className="text-text-body">審査者:</span>
                  <span className="font-medium text-text-dark">
                    {entry.reviewerName ?? "不明"}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-card-border bg-background p-4 text-sm">
                <p className="font-medium text-text-dark">理由</p>
                <p className="mt-2 whitespace-pre-wrap text-text-body">
                  {entry.reviewComment ?? "理由なし"}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

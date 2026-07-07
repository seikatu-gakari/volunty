import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  SearchX,
  User,
  XCircle,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchMatchingHistory } from "@/lib/dashboard/actions";
import type {
  MatchingHistoryItem,
  MatchingHistoryStatus,
} from "@/lib/dashboard/types";

export const dynamic = "force-dynamic";

function statusDisplay(status: MatchingHistoryStatus) {
  switch (status) {
    case "approved":
      return {
        label: "承認済み",
        icon: <CheckCircle2 className="size-4" />,
        color: "text-green-700 bg-green-50 border-green-200",
      };
    case "rejected":
      return {
        label: "辞退済み",
        icon: <XCircle className="size-4" />,
        color: "text-red-700 bg-red-50 border-red-200",
      };
    case "completed":
      return {
        label: "活動完了",
        icon: <CheckCircle2 className="size-4" />,
        color: "text-primary bg-primary/10 border-primary/20",
      };
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "未記録";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未記録";

  return date.toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function MatchingHistoryCard({ item }: { item: MatchingHistoryItem }) {
  const display = statusDisplay(item.status);

  return (
    <article aria-label={`${item.opportunity_title}のマッチング履歴`}>
      <Card>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <User className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-dark">
                  {item.participant_name}
                </h2>
                <p className="mt-1 text-sm text-text-body">
                  {item.opportunity_title}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${display.color}`}
            >
              {display.icon}
              {display.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-text-body">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              処理日時: {formatDateTime(item.status_changed_at)}
            </span>
            <span>応募日時: {formatDateTime(item.applied_at)}</span>
          </div>

          <Link
            href={`/dashboard/opportunities/${item.opportunity_id}/applicants/${item.id}`}
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            応募詳細を見る
            <ChevronRight className="size-4" />
          </Link>
        </CardContent>
      </Card>
    </article>
  );
}

export default async function DashboardHistoryPage() {
  const { history, error } = await fetchMatchingHistory();

  if (error === "ログインが必要です") {
    redirect("/login");
  }
  if (error === "団体アカウントのみ利用できます") {
    redirect("/onboarding/role");
  }
  if (error === "団体プロフィールが見つかりません") {
    redirect("/onboarding/organization");
  }
  if (error === "承認済み団体のみ利用できます") {
    redirect("/onboarding/pending");
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          ダッシュボードに戻る
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-dark">マッチング履歴</h1>
          <p className="mt-2 text-sm text-text-body">
            過去に承認・辞退・活動完了した応募の履歴を確認できます。
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-card-border bg-white p-4 text-sm text-text-body">
            {error}
          </div>
        )}

        {history.length > 0 ? (
          <div className="space-y-4">
            {history.map((item) => (
              <MatchingHistoryCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <SearchX className="size-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-text-dark">
                  承認・辞退・活動完了済みの応募はまだありません
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-text-body">
                応募者一覧で承認、辞退または活動完了した応募が、ここに履歴として表示されます。
              </p>
              <Link
                href="/dashboard"
                className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <History className="size-4" />
                募集案件を確認する
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

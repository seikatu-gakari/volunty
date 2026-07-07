import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquarePlus,
  SearchX,
  XCircle,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchDashboardApproaches } from "@/lib/approaches/actions";
import type { ApproachStatus } from "@/lib/approaches/types";

export const dynamic = "force-dynamic";

function statusDisplay(status: ApproachStatus, isExpired: boolean) {
  if (isExpired) {
    return {
      label: "期限切れ",
      icon: <Clock className="size-4" />,
      color: "text-text-body bg-background border-card-border",
    };
  }

  switch (status) {
    case "accepted":
      return {
        label: "承諾済み",
        icon: <CheckCircle2 className="size-4" />,
        color: "text-green-700 bg-green-50 border-green-200",
      };
    case "declined":
      return {
        label: "辞退済み",
        icon: <XCircle className="size-4" />,
        color: "text-red-700 bg-red-50 border-red-200",
      };
    default:
      return {
        label: "未回答",
        icon: <Clock className="size-4" />,
        color: "text-yellow-700 bg-yellow-50 border-yellow-200",
      };
  }
}

export default async function DashboardApproachesPage() {
  const { approaches, error } = await fetchDashboardApproaches();

  if (error === "ログインが必要です") {
    redirect("/login");
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

        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-dark">
              アプローチ送信履歴
            </h1>
            <p className="mt-2 text-sm text-text-body">
              送信したアプローチと参加者からの回答状況を確認できます。
            </p>
          </div>
          <Link
            href="/dashboard/participants"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            <MessageSquarePlus className="size-4" />
            参加者を探す
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-card-border bg-white p-4 text-sm text-text-body">
            {error}
          </div>
        )}

        {approaches.length > 0 ? (
          <div className="space-y-4">
            {approaches.map((approach) => {
              const display = statusDisplay(
                approach.status,
                approach.isExpired
              );
              return (
                <article
                  key={approach.id}
                  aria-label={`${approach.opportunityTitle}のアプローチ履歴`}
                >
                  <Card>
                    <CardContent>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="text-base font-bold text-text-dark">
                            {approach.participantName}
                          </h2>
                          <p className="mt-1 text-sm text-text-body">
                            {approach.opportunityTitle}
                          </p>
                        </div>
                        <span
                          className={`inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${display.color}`}
                        >
                          {display.icon}
                          {display.label}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-text-body">
                        {approach.message}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-text-body">
                        <span>
                          送信日:{" "}
                          {new Date(approach.createdAt).toLocaleDateString(
                            "ja-JP"
                          )}
                        </span>
                        <span>
                          回答期限:{" "}
                          {new Date(approach.expiresAt).toLocaleDateString(
                            "ja-JP"
                          )}
                        </span>
                        {approach.respondedAt && (
                          <span>
                            回答日:{" "}
                            {new Date(approach.respondedAt).toLocaleDateString(
                              "ja-JP"
                            )}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </article>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <SearchX className="size-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-text-dark">
                  送信したアプローチはまだありません
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-text-body">
                参加者一覧から、募集案件に合いそうな参加者へアプローチできます。
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

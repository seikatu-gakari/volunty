import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Inbox,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { requireParticipantViewer } from "@/lib/auth/page-viewer";
import { fetchMyApproachesQuery } from "@/lib/approaches/queries";
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

export default async function MyApproachesPage() {
  const viewer = requireParticipantViewer(await getViewerContext());
  const { approaches, error } = await fetchMyApproachesQuery(viewer.identity.id);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/mypage"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          マイページに戻る
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-dark">
            受信アプローチ
          </h1>
          <p className="mt-2 text-sm text-text-body">
            団体から届いたアプローチを確認できます。
          </p>
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
                <Link key={approach.id} href={`/mypage/approaches/${approach.id}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="text-base font-bold text-text-dark">
                            {approach.organizationName}
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
                      <p className="line-clamp-2 text-sm leading-6 text-text-body">
                        {approach.message}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-text-body">
                        <span>
                          受信日:{" "}
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
                      </div>
                      {approach.hasContact && (
                        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3">
                          <MessageCircle className="size-4 text-green-700" />
                          <span className="text-sm font-medium text-green-800">
                            連絡先を表示できます
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <Inbox className="size-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-text-dark">
                  まだアプローチは届いていません
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-text-body">
                団体からアプローチが届くと、ここに一覧表示されます。
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageCircle,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchMyApproachDetail } from "@/lib/approaches/actions";
import type { ApproachStatus } from "@/lib/approaches/types";
import { ApproachResponseActions } from "./ApproachResponseActions";

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

export default async function MyApproachDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { approach, error } = await fetchMyApproachDetail(id);

  if (error === "ログインが必要です") {
    redirect("/login");
  }
  if (error === "参加者プロフィールが見つかりません") {
    redirect("/onboarding/participant");
  }
  if (!approach) {
    notFound();
  }

  const display = statusDisplay(approach.status, approach.isExpired);
  const contact =
    approach.status === "accepted" && approach.hasContact
      ? approach.contact
      : null;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/mypage/approaches"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          受信アプローチ一覧に戻る
        </Link>

        <Card className="mb-6">
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl font-bold text-text-dark">
                  {approach.organizationName}
                </h1>
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
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-body">
              <span>
                受信日:{" "}
                {new Date(approach.createdAt).toLocaleDateString("ja-JP")}
              </span>
              <span>
                回答期限:{" "}
                {new Date(approach.expiresAt).toLocaleDateString("ja-JP")}
              </span>
              {approach.respondedAt && (
                <span>
                  回答日:{" "}
                  {new Date(approach.respondedAt).toLocaleDateString("ja-JP")}
                </span>
              )}
              {approach.matchScore !== null && (
                <span>相性スコア: {Math.round(approach.matchScore)}%</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              <h2 className="text-lg font-bold text-text-dark">
                アプローチ文
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap leading-7 text-text-body">
              {approach.message}
            </p>
            <div className="mt-4 rounded-lg bg-background p-4 text-xs leading-6 text-text-body">
              アプリ内でメッセージのやり取りはできません。承諾後にLINE等で連絡します。
            </div>
          </CardContent>
        </Card>

        {approach.status === "sent" && !approach.isExpired && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">
                このアプローチに回答する
              </h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-text-body">
                承諾すると、団体の LINE ID などの連絡先がこの画面に表示されます。
              </p>
              <ApproachResponseActions approachId={approach.id} />
            </CardContent>
          </Card>
        )}

        {approach.isExpired && (
          <Card className="mb-6">
            <CardContent>
              <p className="text-sm leading-6 text-text-body">
                回答期限を過ぎているため、このアプローチには回答できません。
              </p>
            </CardContent>
          </Card>
        )}

        {contact && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageCircle className="size-5 text-primary" />
                <h2 className="text-lg font-bold text-text-dark">
                  団体連絡先
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                {contact.lineId && (
                  <div className="rounded-lg bg-green-50 p-3">
                    <dt className="text-xs text-green-700">LINE ID</dt>
                    <dd className="mt-1 font-medium text-green-800">
                      {contact.lineId}
                    </dd>
                  </div>
                )}
                {contact.lineUrl && (
                  <div className="rounded-lg bg-green-50 p-3">
                    <dt className="text-xs text-green-700">LINE URL</dt>
                    <dd className="mt-1">
                      <a
                        href={contact.lineUrl}
                        className="font-medium text-green-800 underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {contact.lineUrl}
                      </a>
                    </dd>
                  </div>
                )}
                {contact.email && (
                  <div className="rounded-lg bg-green-50 p-3">
                    <dt className="text-xs text-green-700">メール</dt>
                    <dd className="mt-1 font-medium text-green-800">
                      {contact.email}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

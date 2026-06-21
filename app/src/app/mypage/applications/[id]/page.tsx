import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  MapPin,
  Calendar,
  Tag,
  Monitor,
  FileCheck2,
} from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { LineContactCard } from "@/app/components/LineContactCard";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { buildLineFriendContact } from "@/lib/line/contact";
import { fetchMyApplicationDetail } from "@/lib/mypage/actions";
import type { ApplicationStatus } from "@/lib/mypage/types";

export const dynamic = "force-dynamic";

function statusDisplay(status: ApplicationStatus) {
  switch (status) {
    case "pending":
      return {
        label: "審査中",
        icon: <Clock className="size-4" />,
        color: "text-yellow-700 bg-yellow-50 border-yellow-200",
      };
    case "approved":
      return {
        label: "マッチング成立",
        icon: <CheckCircle2 className="size-4" />,
        color: "text-green-700 bg-green-50 border-green-200",
      };
    case "completed":
      return {
        label: "活動完了",
        icon: <CheckCircle2 className="size-4" />,
        color: "text-primary bg-primary/10 border-primary/20",
      };
    case "rejected":
      return {
        label: "辞退",
        icon: <XCircle className="size-4" />,
        color: "text-red-700 bg-red-50 border-red-200",
      };
  }
}

function formatDate(isoString: string | null): string | null {
  if (!isoString) return null;
  return new Date(isoString).toLocaleDateString("ja-JP");
}

function participationModeLabel(mode: string | null): string | null {
  if (!mode) return null;
  const labels: Record<string, string> = {
    online: "オンライン",
    offline: "対面",
    hybrid: "ハイブリッド",
  };
  return labels[mode] ?? mode;
}

export default async function MyApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { application, error } = await fetchMyApplicationDetail(id);

  if (error === "ログインが必要です") {
    redirect("/login");
  }
  if (!application) {
    notFound();
  }

  const display = statusDisplay(application.status);
  const lineContact = buildLineFriendContact({
    url: application.opportunity.organization_line_url,
    id: application.opportunity.organization_line_id,
  });

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/mypage"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          マイページに戻る
        </Link>

        <Card className="mb-6">
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-xl font-bold text-text-dark">
                  {application.opportunity.title}
                </h1>
                <p className="mt-1 text-sm text-text-body">
                  {application.opportunity.organization_name}
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
              <span>応募日: {formatDate(application.applied_at)}</span>
              {application.completed_at && (
                <span>完了日: {formatDate(application.completed_at)}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {application.message && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                <h2 className="text-lg font-bold text-text-dark">
                  応募メッセージ
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap leading-7 text-text-body">
                {application.message}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-text-dark">案件詳細</h2>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {application.opportunity.description && (
                <div>
                  <dt className="text-xs text-text-body">説明</dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-6 text-text-dark">
                    {application.opportunity.description}
                  </dd>
                </div>
              )}
              {application.opportunity.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-text-body" />
                  <span className="text-text-body">場所</span>
                  <span className="ml-auto text-text-dark">
                    {application.opportunity.location}
                  </span>
                </div>
              )}
              {(application.opportunity.start_date ||
                application.opportunity.end_date) && (
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 shrink-0 text-text-body" />
                  <span className="text-text-body">期間</span>
                  <span className="ml-auto text-text-dark">
                    {formatDate(application.opportunity.start_date) ?? "未定"}
                    {" 〜 "}
                    {formatDate(application.opportunity.end_date) ?? "未定"}
                  </span>
                </div>
              )}
              {application.opportunity.category && (
                <div className="flex items-center gap-2">
                  <Tag className="size-4 shrink-0 text-text-body" />
                  <span className="text-text-body">カテゴリ</span>
                  <span className="ml-auto text-text-dark">
                    {application.opportunity.category}
                  </span>
                </div>
              )}
              {application.opportunity.participation_mode && (
                <div className="flex items-center gap-2">
                  <Monitor className="size-4 shrink-0 text-text-body" />
                  <span className="text-text-body">参加形態</span>
                  <span className="ml-auto text-text-dark">
                    {participationModeLabel(
                      application.opportunity.participation_mode
                    )}
                  </span>
                </div>
              )}
              {!application.opportunity.description &&
                !application.opportunity.location &&
                !application.opportunity.start_date &&
                !application.opportunity.end_date &&
                !application.opportunity.category &&
                !application.opportunity.participation_mode && (
                  <p className="text-text-body">詳細情報はありません。</p>
                )}
            </dl>
          </CardContent>
        </Card>

        <LineContactCard
          addUrl={lineContact.addUrl}
          displayId={lineContact.displayId}
        />

        {application.can_request_certificate && (
          <Link
            href={`/mypage/certificates/request/${application.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            <FileCheck2 className="size-4" />
            参加証明書を申請する
          </Link>
        )}
      </main>
    </div>
  );
}

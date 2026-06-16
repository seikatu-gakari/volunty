import Link from "next/link";
import { ArrowLeft, MapPin, MessageSquarePlus, Tag, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchApproachSendData } from "@/lib/approaches/actions";

export const dynamic = "force-dynamic";

function formatList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join("、") : fallback;
}

export default async function DashboardParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { participant, opportunities, error } = await fetchApproachSendData(id);

  if (error === "ログインが必要です") {
    redirect("/login");
  }
  if (error === "団体プロフィールが見つかりません") {
    redirect("/onboarding/organization");
  }
  if (error === "承認済み団体のみ利用できます") {
    redirect("/onboarding/pending");
  }
  if (!participant) {
    notFound();
  }

  const availableCount = opportunities.filter(
    (opportunity) => !opportunity.alreadyApproached
  ).length;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/dashboard/participants"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          参加者一覧に戻る
        </Link>

        <Card className="mb-6">
          <CardContent>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <UserRound className="size-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-text-dark">
                    {participant.name}
                  </h1>
                  <p className="mt-1 text-sm text-text-body">
                    {participant.diagnosisType ?? "診断タイプ未設定"}
                  </p>
                </div>
              </div>
              <Link
                href={`/dashboard/approaches/new/${participant.id}`}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
                  availableCount > 0
                    ? "bg-primary text-white hover:bg-primary-dark"
                    : "pointer-events-none border border-card-border bg-white text-text-body"
                }`}
                aria-disabled={availableCount === 0}
              >
                <MessageSquarePlus className="size-4" />
                アプローチする
              </Link>
            </div>

            {participant.bio && (
              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-text-body">
                {participant.bio}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">
                プロフィール
              </h2>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <dt className="font-medium text-text-dark">地域</dt>
                    <dd className="mt-1 text-text-body">
                      {participant.preferredLocation ?? participant.region}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Tag className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <dt className="font-medium text-text-dark">
                      興味カテゴリ
                    </dt>
                    <dd className="mt-1 text-text-body">
                      {formatList(participant.interests, "未設定")}
                    </dd>
                  </div>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">
                アプローチ可能な案件
              </h2>
            </CardHeader>
            <CardContent>
              {opportunities.length > 0 ? (
                <div className="space-y-3">
                  {opportunities.map((opportunity) => (
                    <div
                      key={opportunity.id}
                      className="rounded-lg border border-card-border px-3 py-2 text-sm"
                    >
                      <div className="font-medium text-text-dark">
                        {opportunity.title}
                      </div>
                      <div className="mt-1 text-xs text-text-body">
                        {opportunity.alreadyApproached
                          ? "この案件では送信済みです"
                          : "送信できます"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-text-body">
                  公開中の募集案件がありません。先に募集案件を公開してください。
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

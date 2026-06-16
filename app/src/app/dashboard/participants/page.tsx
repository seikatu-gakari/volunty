import Link from "next/link";
import { ArrowLeft, MapPin, MessageSquarePlus, SearchX, Tag, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchApproachableParticipants } from "@/lib/approaches/actions";
import type { ApproachableParticipant } from "@/lib/approaches/types";

export const dynamic = "force-dynamic";

function formatList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join("、") : fallback;
}

function ParticipantCard({
  participant,
}: {
  participant: ApproachableParticipant;
}) {
  return (
    <Link
      href={`/dashboard/participants/${participant.id}`}
      className="block rounded-lg border border-card-border bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UserRound className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-text-dark">
                {participant.name}
              </h2>
              <p className="mt-1 text-xs text-text-body">
                {participant.diagnosisType ?? "診断タイプ未設定"}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-card-border px-2.5 py-1 text-xs text-text-body">
            送信済み {participant.sentApproachCount}件
          </span>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 text-text-body">
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="truncate">
              {participant.preferredLocation ?? participant.region}
            </span>
          </div>
          <div className="flex items-center gap-2 text-text-body">
            <Tag className="size-4 shrink-0 text-primary" />
            <span className="truncate">
              {formatList(participant.interests, "興味カテゴリ未設定")}
            </span>
          </div>
        </dl>

        <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <MessageSquarePlus className="size-4" />
          詳細を確認してアプローチ
        </span>
      </div>
    </Link>
  );
}

export default async function DashboardParticipantsPage() {
  const { participants, error } = await fetchApproachableParticipants();

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
              参加者を探す
            </h1>
            <p className="mt-2 text-sm text-text-body">
              公開プロフィールの参加者に、募集案件単位でアプローチできます。
            </p>
          </div>
          <Link
            href="/dashboard/approaches"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-medium text-text-dark shadow-sm transition-colors hover:bg-primary/5"
          >
            送信履歴を見る
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-card-border bg-white p-4 text-sm text-text-body">
            {error}
          </div>
        )}

        {participants.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {participants.map((participant) => (
              <ParticipantCard key={participant.id} participant={participant} />
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
                  公開参加者がまだいません
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-text-body">
                参加者がプロフィールを公開すると、ここからアプローチできます。
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

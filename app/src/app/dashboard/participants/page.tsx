import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  MapPin,
  SearchX,
  Sparkles,
  Tag,
  UserRound,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchRecommendedParticipants } from "@/lib/dashboard/actions";
import type { RecommendedParticipantsEmptyReason } from "@/lib/dashboard/types";
import type { RecommendedParticipant } from "@/lib/dashboard/recommended-participants";

export const dynamic = "force-dynamic";

function formatList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join("、") : fallback;
}

function emptyStateMessage(reason?: RecommendedParticipantsEmptyReason): {
  description: string;
  title: string;
} {
  if (reason === "no_published_opportunities") {
    return {
      title: "公開中の募集案件がありません",
      description:
        "おすすめ参加者を表示するには、求める特性を設定した募集案件を公開してください。",
    };
  }

  return {
    title: "条件に合う参加者がまだいません",
    description:
      "公開プロフィールかつ診断済みの参加者が見つかると、相性スコア順に表示されます。",
  };
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-text-dark">{score}%</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function ParticipantCard({
  participant,
}: {
  participant: RecommendedParticipant;
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
                {participant.diagnosisTypeLabel ?? "診断タイプ未設定"}
              </p>
            </div>
          </div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-text-body/60" />
        </div>

        <div className="rounded-lg bg-background px-3 py-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-text-body">
            <Sparkles className="size-4 text-primary" />
            相性スコア
            <span className="ml-auto text-text-body">
              {participant.bestOpportunityTitle}
            </span>
          </div>
          <ScoreBar score={participant.matchScore} />
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
          <div className="flex items-center gap-2 text-text-body sm:col-span-2">
            <Brain className="size-4 shrink-0 text-primary" />
            <span className="truncate">
              {formatList(participant.availabilitySummary, "参加可能形態未設定")}
            </span>
          </div>
        </dl>
      </div>
    </Link>
  );
}

export default async function DashboardParticipantsPage() {
  const { participants, emptyReason, error } =
    await fetchRecommendedParticipants();

  if (error === "ログインが必要です") {
    redirect("/login");
  }
  if (error === "団体プロフィールが見つかりません") {
    redirect("/onboarding/organization");
  }
  if (error === "承認済み団体のみ利用できます") {
    redirect("/onboarding/pending");
  }

  const emptyState = emptyStateMessage(emptyReason);

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
              おすすめ参加者
            </h1>
            <p className="mt-2 text-sm text-text-body">
              自団体の公開中募集案件に対する最高相性スコア順で表示しています。
            </p>
          </div>
          <Link
            href="/dashboard/opportunities/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            <Sparkles className="size-4" />
            募集案件を作成
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
              <ParticipantCard
                key={participant.id}
                participant={participant}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  {emptyReason === "no_published_opportunities" ? (
                    <Users className="size-5 text-primary" />
                  ) : (
                    <SearchX className="size-5 text-primary" />
                  )}
                </div>
                <h2 className="text-lg font-bold text-text-dark">
                  {emptyState.title}
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-text-body">
                {emptyState.description}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

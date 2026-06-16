import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  MapPin,
  MessageSquarePlus,
  Sparkles,
  Tag,
  UserRound,
} from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { fetchApproachSendData } from "@/lib/approaches/actions";
import { fetchRecommendedParticipantDetail } from "@/lib/dashboard/actions";
import type { RecommendedParticipant } from "@/lib/dashboard/recommended-participants";

export const dynamic = "force-dynamic";

const BIG5_LABELS: Array<{
  key: keyof RecommendedParticipant["diagnosisScores"];
  label: string;
}> = [
  { key: "extraversion", label: "外向性" },
  { key: "agreeableness", label: "協調性" },
  { key: "conscientiousness", label: "誠実性" },
  { key: "neuroticism", label: "神経症傾向" },
  { key: "openness", label: "開放性" },
];

function formatList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join("、") : fallback;
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-text-body">
          相性スコア
        </span>
        <span className="text-2xl font-bold text-text-dark">{score}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function TraitBar({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-text-body">{label}</span>
        <span className="text-sm font-bold text-text-dark">{score}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function EmptyPublishedOpportunityState() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/dashboard/participants"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          おすすめ参加者一覧に戻る
        </Link>
        <Card>
          <CardHeader>
            <h1 className="text-lg font-bold text-text-dark">
              公開中の募集案件がありません
            </h1>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-text-body">
              参加者との相性を計算するには、公開中の募集案件が必要です。
            </p>
            <Link
              href="/dashboard/opportunities/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Sparkles className="size-4" />
              募集案件を作成
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default async function DashboardParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { participant, emptyReason, error } =
    await fetchRecommendedParticipantDetail(id);

  if (error === "ログインが必要です") {
    redirect("/login");
  }
  if (error === "団体プロフィールが見つかりません") {
    redirect("/onboarding/organization");
  }
  if (error === "承認済み団体のみ利用できます") {
    redirect("/onboarding/pending");
  }
  if (emptyReason === "no_published_opportunities") {
    return <EmptyPublishedOpportunityState />;
  }
  if (!participant) {
    notFound();
  }

  const {
    opportunities,
    error: approachError,
  } = await fetchApproachSendData(id);

  if (approachError === "ログインが必要です") {
    redirect("/login");
  }
  if (approachError === "団体プロフィールが見つかりません") {
    redirect("/onboarding/organization");
  }
  if (approachError === "承認済み団体のみ利用できます") {
    redirect("/onboarding/pending");
  }
  if (approachError === "参加者が見つかりません") {
    notFound();
  }

  const availableCount = opportunities.filter(
    (opportunity) => !opportunity.alreadyApproached
  ).length;
  const canApproach = !approachError && availableCount > 0;
  const disabledApproachLabel = approachError
    ? "アプローチ準備不可"
    : "送信可能な案件がありません";

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <Link
          href="/dashboard/participants"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          おすすめ参加者一覧に戻る
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
                    {participant.diagnosisTypeLabel ?? "診断タイプ未設定"}
                  </p>
                </div>
              </div>
              {canApproach ? (
                <Link
                  href={`/dashboard/approaches/new/${participant.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
                >
                  <MessageSquarePlus className="size-4" />
                  アプローチする
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-medium text-text-body"
                >
                  <MessageSquarePlus className="size-4" />
                  {disabledApproachLabel}
                </button>
              )}
            </div>

            {participant.bio && (
              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-text-body">
                {participant.bio}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="text-lg font-bold text-text-dark">相性概要</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-5 rounded-lg bg-background p-4">
              <p className="mb-3 text-xs text-text-body">
                最も相性が高い募集案件: {participant.bestOpportunityTitle}
              </p>
              <ScoreBar score={participant.matchScore} />
            </div>

            <h3 className="mb-2 text-sm font-bold text-text-dark">相性理由</h3>
            <ul className="space-y-2">
              {participant.matchReasons.map((reason) => (
                <li
                  key={reason}
                  className="rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-text-body"
                >
                  {reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
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
                <div className="flex items-start gap-2">
                  <Brain className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <dt className="font-medium text-text-dark">参加可能形態</dt>
                    <dd className="mt-1 text-text-body">
                      {formatList(participant.availabilitySummary, "未設定")}
                    </dd>
                  </div>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">
                BIG5 スコア
              </h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {BIG5_LABELS.map(({ key, label }) => (
                  <TraitBar
                    key={key}
                    label={label}
                    score={participant.diagnosisScores[key]}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold text-text-dark">
              アプローチ可能な案件
            </h2>
          </CardHeader>
          <CardContent>
            {approachError ? (
              <p className="text-sm leading-6 text-text-body">
                {approachError}
              </p>
            ) : opportunities.length > 0 ? (
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
      </main>
    </div>
  );
}

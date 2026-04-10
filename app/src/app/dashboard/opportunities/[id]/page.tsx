import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Clock,
  Lock,
  Unlock,
  Pencil,
  MessageSquare,
  Sparkles,
  Brain,
  User,
  ChevronRight,
} from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicantsForOpportunity } from "@/lib/dashboard/actions";
import type { Applicant, OpportunityStatus } from "@/lib/dashboard/types";
import { StatusActions } from "./components/StatusActions";

/** BIG5 特性の日本語ラベル */
const BIG5_LABELS: Record<string, string> = {
  extraversion: "外向性",
  agreeableness: "協調性",
  conscientiousness: "誠実性",
  neuroticism: "神経症傾向",
  openness: "開放性",
};

/** 案件ステータス表示 */
function opportunityStatusDisplay(status: OpportunityStatus) {
  switch (status) {
    case "open":
      return {
        label: "募集中",
        icon: <Unlock className="size-4" />,
        color: "text-green-700 bg-green-50 border-green-200",
      };
    case "closed":
      return {
        label: "募集終了",
        icon: <Lock className="size-4" />,
        color: "text-gray-700 bg-gray-50 border-gray-200",
      };
  }
}

/** BIG5 スコアの概要表示 */
function ScoresSummary({
  scores,
}: {
  scores: Record<string, number> | null;
}) {
  if (!scores) {
    return (
      <p className="text-xs text-text-body">診断未実施</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(BIG5_LABELS).map(([key, label]) => {
        const value = scores[key];
        if (value === undefined) return null;
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded bg-orange-50 px-2 py-0.5 text-xs text-text-body"
          >
            {label}
            <span className="font-medium text-text-dark">{value}</span>
          </span>
        );
      })}
    </div>
  );
}

/** 応募者カード */
function ApplicantCard({
  applicant,
  opportunityId,
}: {
  applicant: Applicant;
  opportunityId: string;
}) {
  return (
    <div className="rounded-lg border border-card-border p-4">
      <div className="flex flex-col gap-3">
        {/* ヘッダー: 名前 + ステータス操作 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <User className="size-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text-dark">
                {applicant.participant_name}
              </span>
              {applicant.diagnosis_type && (
                <span className="text-xs text-text-body">
                  {applicant.diagnosis_type}
                </span>
              )}
            </div>
          </div>
          <StatusActions
            applicationId={applicant.id}
            currentStatus={applicant.status}
          />
        </div>

        {/* マッチングスコア */}
        {applicant.match_score !== null && (
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="text-xs text-text-body">相性スコア</span>
            <span className="text-sm font-bold text-text-dark">
              {applicant.match_score}%
            </span>
            <div className="ml-1 h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${
                  applicant.match_score >= 80
                    ? "bg-primary"
                    : applicant.match_score >= 60
                      ? "bg-primary-dark"
                      : "bg-text-body"
                }`}
                style={{ width: `${applicant.match_score}%` }}
              />
            </div>
          </div>
        )}

        {/* BIG5 スコア概要 */}
        <div className="flex items-start gap-2">
          <Brain className="mt-0.5 size-4 shrink-0 text-text-body/50" />
          <ScoresSummary scores={applicant.diagnosis_scores} />
        </div>

        {/* 応募メッセージ */}
        {applicant.message && (
          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 size-4 shrink-0 text-text-body/50" />
            <p className="text-xs leading-5 text-text-body">
              {applicant.message}
            </p>
          </div>
        )}

        {/* 応募日 + 詳細リンク */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-text-body/70">
            <Clock className="size-3" />
            応募日: {new Date(applicant.created_at).toLocaleDateString("ja-JP")}
          </div>
          <Link
            href={`/dashboard/opportunities/${opportunityId}/applicants/${applicant.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            詳細を見る
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function OpportunityApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 認証チェック
  let isAuthenticated = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    isAuthenticated = !!data.user;
  } catch {
    // Supabase 未設定時
  }

  if (!isAuthenticated) {
    redirect("/login");
  }

  const { data, error } = await fetchApplicantsForOpportunity(id);

  // 案件が存在しない、またはアクセス権がない場合
  if (!data) {
    if (error === "ログインが必要です") {
      redirect("/login");
    }
    notFound();
  }

  const statusDisplay = opportunityStatusDisplay(data.status);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* 戻るリンク */}
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          ダッシュボードに戻る
        </Link>

        {/* 案件ヘッダー */}
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold text-text-dark">
                {data.title}
              </h1>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusDisplay.color}`}
                >
                  {statusDisplay.icon}
                  {statusDisplay.label}
                </span>
                <span className="text-xs text-text-body">
                  作成日:{" "}
                  {new Date(data.created_at).toLocaleDateString("ja-JP")}
                </span>
              </div>
            </div>
            <Link
              href={`/dashboard/opportunities/${id}/edit`}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-medium text-text-dark transition-colors hover:bg-gray-50"
            >
              <Pencil className="size-3.5" />
              編集
            </Link>
          </div>

          {/* 案件説明 */}
          {data.description && (
            <p className="text-sm leading-6 text-text-body">
              {data.description}
            </p>
          )}
        </div>

        {/* 応募者一覧 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="size-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-text-dark">応募者一覧</h2>
                <span className="text-xs text-text-body">
                  {data.applicants.length}件の応募
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data.applicants.length > 0 ? (
              <div className="flex flex-col gap-4">
                {data.applicants.map((applicant) => (
                  <ApplicantCard key={applicant.id} applicant={applicant} opportunityId={id} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <Users className="size-10 text-text-body/30" />
                <p className="text-sm text-text-body">
                  まだ応募者がいません。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Users,
  Clock,
  Lock,
  Unlock,
  Pencil,
  MessageSquare,
  Brain,
  User,
  ChevronRight,
  CircleDashed,
  Filter,
} from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicantsForOpportunity } from "@/lib/dashboard/actions";
import type {
  Applicant,
  ApplicantSort,
  ApplicantStatusFilter,
  OpportunityStatus,
} from "@/lib/dashboard/types";
import { BulkCompleteActions } from "./components/BulkCompleteActions";
import { StatusActions } from "./components/StatusActions";
import { OpportunityCreatedDate } from "./OpportunityCreatedDate";

/** 案件ステータス表示 */
function opportunityStatusDisplay(status: OpportunityStatus) {
  switch (status) {
    case "draft":
      return {
        label: "下書き",
        icon: <CircleDashed className="size-4" />,
        color: "text-yellow-700 bg-yellow-50 border-yellow-200",
      };
    case "published":
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
              {applicant.style_type_label && (
                <span className="text-xs text-text-body">
                  {applicant.style_type_label}（参考タイプ）
                </span>
              )}
            </div>
          </div>
          <StatusActions
            applicationId={applicant.id}
            currentStatus={applicant.status}
          />
        </div>

        {/* 診断状況（生スコアは開示しない） */}
        {!applicant.style_type_label && (
          <div className="flex items-start gap-2">
            <Brain className="mt-0.5 size-4 shrink-0 text-text-body/50" />
            <p className="text-xs text-text-body">診断未実施</p>
          </div>
        )}

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
          <div className="flex flex-col gap-1 text-xs text-text-body/70">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              応募日: {new Date(applicant.created_at).toLocaleDateString("ja-JP")}
            </span>
            {applicant.completed_at && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                完了日:{" "}
                {new Date(applicant.completed_at).toLocaleDateString("ja-JP")}
              </span>
            )}
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sort?: string; status?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const sort =
    query?.sort === "compatibility" ||
    query?.sort === "applied_asc" ||
    query?.sort === "applied_desc"
      ? (query.sort as ApplicantSort)
      : "applied_desc";
  const status =
    query?.status === "pending" ||
    query?.status === "approved" ||
    query?.status === "rejected" ||
    query?.status === "completed"
      ? (query.status as ApplicantStatusFilter)
      : "all";

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

  const { data, error } = await fetchApplicantsForOpportunity(id, {
    sort,
    status,
  });

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
                  <OpportunityCreatedDate createdAt={data.created_at} />
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
            <form
              method="get"
              className="mb-4 grid gap-3 rounded-lg border border-card-border bg-background/60 p-4 sm:grid-cols-[1fr_1fr_auto]"
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-text-dark">
                  並び替え
                </span>
                <select
                  name="sort"
                  defaultValue={sort}
                  className="h-10 rounded-lg border border-input-border bg-white px-3 text-sm"
                >
                  <option value="applied_desc">応募日が新しい順</option>
                  <option value="applied_asc">応募日が古い順</option>
                  <option value="compatibility">相性スコア順</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-text-dark">
                  ステータス
                </span>
                <select
                  name="status"
                  defaultValue={status}
                  className="h-10 rounded-lg border border-input-border bg-white px-3 text-sm"
                >
                  <option value="all">すべて</option>
                  <option value="pending">未対応のみ</option>
                  <option value="approved">承認済みのみ</option>
                  <option value="rejected">辞退済み</option>
                  <option value="completed">活動完了のみ</option>
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark"
              >
                <Filter className="size-4" />
                適用
              </button>
            </form>
            <BulkCompleteActions
              opportunityId={id}
              applicants={data.applicants}
            />
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

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Brain,
  Sparkles,
  MapPin,
  Calendar,
  Users,
  Tag,
  Globe,
} from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { fetchOpportunityDetail } from "@/lib/opportunities/actions";
import type { ApplicationStatus } from "@/lib/opportunities/types";
import { PARTICIPATION_MODE_OPTIONS } from "@/lib/opportunities/constants";
import { TraitVisualization } from "./components/TraitVisualization";
import { ApplyForm } from "./components/ApplyForm";

/** 応募ステータスに応じたラベル・アイコン・カラー */
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
        label: "承認",
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

export default async function OpportunityDetailPage({
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

  const { opportunity, matchScore, existingApplication, isParticipant } =
    await fetchOpportunityDetail(id);

  // 案件が存在しない場合は 404
  if (!opportunity) {
    notFound();
  }

  const isClosed = opportunity.status === "closed";
  // 応募フォーム表示条件: 参加者 かつ 未応募 かつ 募集中
  const showApplyForm =
    isParticipant && !existingApplication && !isClosed;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* 戻るリンク */}
        <Link
          href="/recommendations"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          おすすめ案件に戻る
        </Link>

        {/* 募集終了メッセージ */}
        {isClosed && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            この案件は募集を終了しています
          </div>
        )}

        {/* 案件タイトル */}
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-text-dark">
            {opportunity.title}
          </h1>
          <p className="text-sm text-text-body">
            掲載日:{" "}
            {new Date(opportunity.created_at).toLocaleDateString("ja-JP")}
          </p>
        </div>

        {/* マッチングスコア（参加者かつ診断済みの場合） */}
        {matchScore !== null && (
          <Card className="mb-6">
            <CardContent>
              <div className="flex items-center gap-4">
                <Sparkles className="size-6 text-primary" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-dark">
                      あなたとの相性
                    </span>
                    <span className="text-2xl font-bold text-text-dark">
                      {matchScore}
                      <span className="text-sm font-normal text-text-body">
                        %
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        matchScore >= 80
                          ? "bg-primary"
                          : matchScore >= 60
                            ? "bg-primary-dark"
                            : "bg-text-body"
                      }`}
                      style={{ width: `${matchScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 案件説明 */}
        {opportunity.description && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">案件概要</h2>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-text-body">
                {opportunity.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 募集情報 */}
        {(opportunity.location ||
          opportunity.start_date ||
          opportunity.end_date ||
          opportunity.capacity !== null ||
          opportunity.category ||
          opportunity.participation_mode) && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">募集情報</h2>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-3 text-sm">
                {opportunity.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="size-4 shrink-0 text-primary" />
                    <dt className="w-24 shrink-0 text-text-body">活動場所</dt>
                    <dd className="text-text-dark">{opportunity.location}</dd>
                  </div>
                )}
                {(opportunity.start_date || opportunity.end_date) && (
                  <div className="flex items-center gap-3">
                    <Calendar className="size-4 shrink-0 text-primary" />
                    <dt className="w-24 shrink-0 text-text-body">開催期間</dt>
                    <dd className="text-text-dark">
                      {opportunity.start_date
                        ? new Date(opportunity.start_date).toLocaleDateString(
                            "ja-JP"
                          )
                        : "未定"}
                      {" 〜 "}
                      {opportunity.end_date
                        ? new Date(opportunity.end_date).toLocaleDateString(
                            "ja-JP"
                          )
                        : "未定"}
                    </dd>
                  </div>
                )}
                {opportunity.capacity !== null && (
                  <div className="flex items-center gap-3">
                    <Users className="size-4 shrink-0 text-primary" />
                    <dt className="w-24 shrink-0 text-text-body">定員</dt>
                    <dd className="text-text-dark">
                      {opportunity.capacity}名（現在{opportunity.current_applicants}
                      名応募）
                    </dd>
                  </div>
                )}
                {opportunity.participation_mode && (
                  <div className="flex items-center gap-3">
                    <Globe className="size-4 shrink-0 text-primary" />
                    <dt className="w-24 shrink-0 text-text-body">参加形態</dt>
                    <dd className="text-text-dark">
                      {PARTICIPATION_MODE_OPTIONS.find(
                        (o) => o.value === opportunity.participation_mode
                      )?.label ?? opportunity.participation_mode}
                    </dd>
                  </div>
                )}
                {opportunity.category && (
                  <div className="flex items-center gap-3">
                    <Tag className="size-4 shrink-0 text-primary" />
                    <dt className="w-24 shrink-0 text-text-body">カテゴリ</dt>
                    <dd className="text-text-dark">{opportunity.category}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        )}

        {/* 募集団体情報 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="size-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-text-dark">募集団体</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Link
                href={`/organizations/${opportunity.organization.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {opportunity.organization.name}
              </Link>
              {opportunity.organization.description && (
                <p className="text-sm leading-6 text-text-body">
                  {opportunity.organization.description}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 求める性格特性 */}
        {opportunity.required_traits &&
          Object.keys(opportunity.required_traits).length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <Brain className="size-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold text-text-dark">
                    求める性格特性
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                <TraitVisualization
                  requiredTraits={opportunity.required_traits}
                />
              </CardContent>
            </Card>
          )}

        {/* 応募ステータス表示（応募済みの場合） */}
        {existingApplication && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">
                応募ステータス
              </h2>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const display = statusDisplay(
                      existingApplication.status
                    );
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium ${display.color}`}
                      >
                        {display.icon}
                        {display.label}
                      </span>
                    );
                  })()}
                </div>
                {existingApplication.message && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-body">
                      応募メッセージ
                    </span>
                    <p className="text-sm text-text-dark">
                      {existingApplication.message}
                    </p>
                  </div>
                )}
                <p className="text-xs text-text-body">
                  応募日:{" "}
                  {new Date(
                    existingApplication.created_at
                  ).toLocaleDateString("ja-JP")}
                </p>
                {existingApplication.completed_at && (
                  <p className="text-xs text-text-body">
                    完了日:{" "}
                    {new Date(
                      existingApplication.completed_at
                    ).toLocaleDateString("ja-JP")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 応募フォーム（参加者のみ、未応募、募集中の場合） */}
        {showApplyForm && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">
                この案件に応募する
              </h2>
            </CardHeader>
            <CardContent>
              <ApplyForm opportunityId={opportunity.id} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

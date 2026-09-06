import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { getViewerContext } from "@/lib/auth/viewer-context";
import { fetchOpportunityViewerState } from "@/lib/opportunities/queries";
import { fetchPublicOpportunityDetail } from "@/lib/opportunities/public-detail";
import { getOpportunityActionMode } from "@/lib/opportunities/detail-access";
import type { ApplicationStatus } from "@/lib/opportunities/types";
import { PARTICIPATION_MODE_OPTIONS } from "@/lib/opportunities/constants";
import { applicationStatusLabel } from "@/lib/mypage/status";
import {
  buildOpportunityLoginHref,
  getOpportunityBackLink,
  getOpportunityViewSource,
  type OpportunitySearchParams,
} from "@/lib/opportunities/navigation";
import { ApplyForm } from "./components/ApplyForm";
import { BookmarkButton } from "./components/BookmarkButton";
import { ApplicationStatusDate } from "./ApplicationStatusDate";
import { OpportunityPublicationDate } from "./OpportunityPublicationDate";

const getPublicOpportunity = cache(fetchPublicOpportunityDetail);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const opportunity = await getPublicOpportunity(id);
  if (!opportunity) return { title: "募集が見つかりません", robots: { index: false } };
  return {
    title: opportunity.title,
    description: opportunity.description ?? `${opportunity.organization.name}のボランティア募集`,
    robots: { index: false },
    openGraph: {
      title: opportunity.title,
      description: opportunity.description ?? `${opportunity.organization.name}のボランティア募集`,
      type: "article",
    },
  };
}

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
        label: applicationStatusLabel("rejected"),
        icon: <XCircle className="size-4" />,
        color: "text-red-700 bg-red-50 border-red-200",
      };
  }
}

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<
    OpportunitySearchParams & {
      from?: string | string[];
      rlog?: string | string[];
    }
  >;
}) {
  const { id } = await params;
  const query = await searchParams;
  const viewSource = getOpportunityViewSource(query?.from);
  const recommendationLogId = Array.isArray(query?.rlog)
    ? query.rlog[0] ?? null
    : query?.rlog ?? null;

  const viewer = await getViewerContext();
  if (viewer.status === "error") throw new Error("閲覧者情報を確認できませんでした");
  const backLink = getOpportunityBackLink(viewSource, query, viewer.status === "guest");

  const opportunity = await getPublicOpportunity(id);

  // 案件が存在しない場合は 404
  if (!opportunity) {
    notFound();
  }

  const viewerState =
    viewer.status === "authenticated"
      ? await fetchOpportunityViewerState(id, viewer, viewSource)
      : { existingApplication: null, isParticipant: false, isBookmarked: false };
  const { existingApplication, isBookmarked } = viewerState;
  const isParticipant =
    viewer.status === "authenticated" &&
    viewer.isActive &&
    viewer.role === "participant" &&
    viewer.hasParticipantProfile;
  const actionMode = getOpportunityActionMode(viewer, isParticipant);
  const loginHref = buildOpportunityLoginHref(id, query);

  const isClosed = opportunity.status === "closed";
  // 応募フォーム表示条件: 参加者 かつ 未応募 かつ 募集中
  const showApplyForm =
    isParticipant && !existingApplication && !isClosed;
  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* 戻るリンク */}
        <Link
          href={backLink.href}
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          {backLink.label}
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
          <OpportunityPublicationDate createdAt={opportunity.created_at} />
          {actionMode === "participant" && (
            <BookmarkButton
              opportunityId={opportunity.id}
              initialBookmarked={isBookmarked}
            />
          )}
          {actionMode === "login-required" && (
            <Link
              href={loginHref}
              className="inline-flex w-fit rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
            >
              ログインして保存する
            </Link>
          )}
        </div>

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
          opportunity.schedule ||
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
                {opportunity.schedule && (
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
                    <dt className="w-24 shrink-0 text-text-body">開催頻度</dt>
                    <dd className="whitespace-pre-wrap text-text-dark">{opportunity.schedule}</dd>
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
              <p className="text-sm text-text-body">
                安全確認: {opportunity.organization.verified ? "運営による団体確認済み" : "団体確認手続き中"}
              </p>
              {opportunity.organization.website_url && (
                <a className="text-sm text-primary hover:underline" href={opportunity.organization.website_url}>
                  団体ウェブサイト
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 活動スタイル */}
        {opportunity.activity_style_labels.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <Brain className="size-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-text-dark">
                  この活動のスタイル
                </h2>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {opportunity.activity_style_labels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    <Sparkles className="size-3" />
                    {label}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-text-body">
                ※ 活動の進め方の目安です。性格を理由に応募が制限されることはありません。
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-bold text-text-dark">参加前の確認事項</h2>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {[
                ["費用", opportunity.cost],
                ["持ち物", opportunity.belongings],
                ["応募締切", opportunity.application_deadline ? new Date(opportunity.application_deadline).toLocaleDateString("ja-JP") : null],
                ["キャンセル", opportunity.cancellation_policy],
                ["保険・安全情報", opportunity.insurance_details],
                ["問い合わせ方法", opportunity.contact_method],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                  <dt className="font-medium text-text-dark">{label}</dt>
                  <dd className="whitespace-pre-wrap text-text-body">{value || "記載なし"}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* 参加要件（必須資格・年齢） */}
        {(opportunity.required_qualifications.length > 0 ||
          opportunity.min_age !== null ||
          opportunity.max_age !== null) && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">参加要件</h2>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-text-body">
                {opportunity.required_qualifications.map((qualification) => (
                  <li key={qualification} className="flex items-center">
                    <span className="mr-2 text-primary">•</span>
                    {qualification}
                  </li>
                ))}
                {(opportunity.min_age !== null || opportunity.max_age !== null) && (
                  <li className="flex items-center">
                    <span className="mr-2 text-primary">•</span>
                    対象年齢:{" "}
                    {opportunity.min_age !== null ? `${opportunity.min_age}歳` : ""}
                    〜
                    {opportunity.max_age !== null ? `${opportunity.max_age}歳` : ""}
                  </li>
                )}
              </ul>
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
                <ApplicationStatusDate
                  label="応募日"
                  value={existingApplication.created_at}
                />
                {existingApplication.completed_at && (
                  <ApplicationStatusDate
                    label="完了日"
                    value={existingApplication.completed_at}
                  />
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
              <p className="mb-4 text-xs leading-5 text-text-body">
                応募後、団体とのマッチングが成立すると、登録しているLINE IDが団体へ共有されます。
              </p>
              <ApplyForm
                opportunityId={opportunity.id}
                recommendationLogId={recommendationLogId}
              />
            </CardContent>
          </Card>
        )}
        {actionMode === "login-required" && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">応募・保存にはログインが必要です</h2>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href={loginHref} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
                ログインして応募する
              </Link>
              <Link href={loginHref} className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary">
                ログインして保存する
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

import Link from "next/link";
import {
  Plus,
  ClipboardList,
  Clock,
  Users,
  Lock,
  Unlock,
  Pencil,
  BadgeCheck,
  AlertTriangle,
  CircleDashed,
  Building2,
  MessageSquarePlus,
  X,
  FileCheck2,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { fetchMyOpportunities } from "@/lib/dashboard/actions";
import type { OpportunityStatus } from "@/lib/dashboard/types";
import { prisma } from "@/lib/prisma";

/** 案件ステータスに応じたラベル・アイコン・カラー */
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

function reviewStatusDisplay(status: "pending" | "approved" | "rejected") {
  switch (status) {
    case "approved":
      return {
        label: "承認済み",
        icon: <BadgeCheck className="size-4" />,
        color: "border-green-200 bg-green-50 text-green-700",
        description: "現在のプロフィール内容で公開利用できます。",
      };
    case "rejected":
      return {
        label: "否認済み",
        icon: <AlertTriangle className="size-4" />,
        color: "border-red-200 bg-red-50 text-red-700",
        description: "修正後に再申請が必要です。",
      };
    default:
      return {
        label: "審査中",
        icon: <CircleDashed className="size-4" />,
        color: "border-amber-200 bg-amber-50 text-amber-800",
        description: "審査完了まで一部機能は利用できません。",
      };
  }
}

export default async function DashboardPage() {
  // 認証チェック
  let user = null;
  const supabase = await createClient();
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase 未設定時
  }

  if (!user) {
    redirect("/login");
  }

  let organizationProfile: {
    organizationName: string;
    reviewStatus: "pending" | "approved" | "rejected";
    reviewedAt: Date | null;
    profileCompleteness: number;
  } | null = null;

  // Prisma → Supabase フォールバックで団体プロフィールを取得
  try {
    organizationProfile = await prisma.organizationProfile.findUnique({
      where: { userId: user.id },
      select: {
        organizationName: true,
        reviewStatus: true,
        reviewedAt: true,
        profileCompleteness: true,
      },
    });
  } catch (err) {
    console.error("[DashboardPage] Prisma 取得に失敗、Supabase にフォールバック:", err);
    try {
      const { data } = await supabase
        .from("m_organization_profile")
        .select("organization_name, review_status, reviewed_at, profile_completeness")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        const rawStatus = data.review_status as string | null;
        const reviewStatus =
          rawStatus === "approved" || rawStatus === "rejected"
            ? rawStatus
            : "pending";
        organizationProfile = {
          organizationName: data.organization_name ?? "",
          reviewStatus,
          reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : null,
          profileCompleteness: (data.profile_completeness as number) ?? 0,
        };
      }
    } catch (sbErr) {
      console.error("[DashboardPage] Supabase フォールバックも失敗:", sbErr);
    }
  }

  if (!organizationProfile) {
    redirect("/onboarding/organization");
  }

  const { opportunities } = await fetchMyOpportunities();
  const reviewDisplay = reviewStatusDisplay(organizationProfile.reviewStatus);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-text-dark">ダッシュボード</h1>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-medium text-text-dark shadow-sm transition-colors hover:bg-primary/5"
            >
              <X className="size-4" />
              閉じる
            </Link>
            <Link
              href="/dashboard/profile/edit"
              className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-medium text-text-dark shadow-sm transition-colors hover:bg-primary/5"
            >
              <Pencil className="size-4" />
              団体プロフィールを編集
            </Link>
            <Link
              href="/dashboard/participants"
              className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-medium text-text-dark shadow-sm transition-colors hover:bg-primary/5"
            >
              <Users className="size-4" />
              おすすめ参加者を見る
            </Link>
            <Link
              href="/dashboard/approaches"
              className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-medium text-text-dark shadow-sm transition-colors hover:bg-primary/5"
            >
              <MessageSquarePlus className="size-4" />
              アプローチ履歴
            </Link>
            <Link
              href="/dashboard/certificates"
              className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-medium text-text-dark shadow-sm transition-colors hover:bg-primary/5"
            >
              <FileCheck2 className="size-4" />
              証明書申請
            </Link>
            <Link
              href="/dashboard/opportunities/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
            >
              <Plus className="size-4" />
              新しい案件を作成
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          団体プロフィールを更新すると、内容確認のため再審査になります。更新後は審査完了までダッシュボードを利用できません。
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-dark">現在の審査状態</h2>
                <p className="text-sm text-text-body">
                  {organizationProfile.organizationName}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${reviewDisplay.color}`}
                >
                  {reviewDisplay.icon}
                  {reviewDisplay.label}
                </span>
                <p className="mt-2 text-sm text-text-body">{reviewDisplay.description}</p>
              </div>

              <dl className="grid grid-cols-1 gap-3 text-sm sm:min-w-[260px]">
                <div className="flex items-center justify-between gap-4 rounded-lg bg-background px-3 py-2">
                  <dt className="text-text-body">プロフィール充実度</dt>
                  <dd className="font-medium text-text-dark">
                    {organizationProfile.profileCompleteness}%
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg bg-background px-3 py-2">
                  <dt className="text-text-body">前回審査日</dt>
                  <dd className="font-medium text-text-dark">
                    {organizationProfile.reviewedAt
                      ? new Date(organizationProfile.reviewedAt).toLocaleDateString("ja-JP")
                      : "未審査"}
                  </dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>

        {/* 案件一覧セクション */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <ClipboardList className="size-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-text-dark">募集案件一覧</h2>
            </div>
          </CardHeader>
          <CardContent>
            {opportunities.length > 0 ? (
              <div className="flex flex-col gap-4">
                {opportunities.map((opp) => {
                  const display = opportunityStatusDisplay(opp.status);
                  return (
                    <Link
                      key={opp.id}
                      href={`/dashboard/opportunities/${opp.id}`}
                      className="block rounded-lg border border-card-border p-4 transition-shadow hover:shadow-md"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium text-text-dark">
                            {opp.title}
                          </h3>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${display.color}`}
                          >
                            {display.icon}
                            {display.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-text-body">
                          <span className="flex items-center gap-1">
                            <Users className="size-3.5" />
                            応募者 {opp.application_count}件
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5" />
                            {new Date(opp.created_at).toLocaleDateString(
                              "ja-JP"
                            )}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <ClipboardList className="size-10 text-text-body/30" />
                <p className="text-sm text-text-body">
                  まだ募集案件がありません。
                </p>
                <Link
                  href="/dashboard/opportunities/new"
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Plus className="size-4" />
                  最初の案件を作成しましょう
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

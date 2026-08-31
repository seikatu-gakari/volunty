import { redirect } from "next/navigation";
import { Clock, Building2, User, Mail, MapPin, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { PendingActions } from "./PendingActions";

/** 審査待ち画面に表示する団体情報 */
interface PendingOrgProfile {
  organizationName: string;
  representativeName: string | null;
  contactEmail: string | null;
  activityAreas: string[];
  reviewStatus: "pending" | "approved" | "rejected";
  reviewComment: string | null;
}

export default async function OnboardingPendingPage() {
  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive) {
    redirect("/auth/signout?reason=suspended");
  }
  if (viewer.role !== "organization") redirect("/onboarding/role");
  if (!viewer.hasOrganizationProfile) redirect("/onboarding/organization");
  if (viewer.organizationReviewStatus === "approved") redirect("/dashboard");

  const orgProfile = await prisma.organizationProfile.findUnique({
    where: { userId: viewer.identity.id },
    select: {
      organizationName: true,
      representativeName: true,
      contactEmail: true,
      activityAreas: true,
      reviewStatus: true,
      reviewComment: true,
    },
  });
  if (!orgProfile) {
    throw new Error("団体プロフィールを確認できませんでした");
  }
  if (orgProfile.reviewStatus === "approved") {
    redirect("/dashboard");
  }

  const profile: PendingOrgProfile = {
    organizationName: orgProfile.organizationName,
    representativeName: orgProfile.representativeName,
    contactEmail: orgProfile.contactEmail,
    activityAreas: Array.isArray(orgProfile.activityAreas)
      ? (orgProfile.activityAreas as string[])
      : [],
    reviewStatus: orgProfile.reviewStatus,
    reviewComment: orgProfile.reviewComment,
  };
  const reviewStatus = profile.reviewStatus;

  const isRejected = reviewStatus === "rejected";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      {/* ステータスヘッダー */}
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <div className={`flex size-16 items-center justify-center rounded-full ${isRejected ? "bg-red-100" : "bg-primary/10"}`}>
          {isRejected ? (
            <AlertTriangle className="size-8 text-red-600" />
          ) : (
            <Clock className="size-8 text-primary" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-text-dark">
          {isRejected ? "申請は否認されました" : "審査中です"}
        </h1>
        {isRejected ? (
          <>
            <p className="text-text-body">
              登録内容の確認の結果、現時点では申請を承認できませんでした。
            </p>
            {profile.reviewComment && (
              <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-left">
                <p className="text-sm font-medium text-red-800">否認理由</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-red-700">
                  {profile.reviewComment}
                </p>
              </div>
            )}
            <p className="text-sm text-text-body/80">
              内容を修正して再申請できます。修正後は再度審査待ちになります。
            </p>
          </>
        ) : (
          <>
            <p className="text-text-body">
              団体登録の申請を受け付けました。管理者が内容を確認しています。
            </p>
            <p className="text-sm text-text-body/80">
              審査には数日かかる場合があります。承認され次第、ダッシュボードへアクセスできるようになります。
            </p>
          </>
        )}
      </div>

      {/* 登録情報カード */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="size-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-text-dark">登録情報</h2>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-4">
            {/* 団体名 */}
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 size-4 shrink-0 text-text-body/60" />
              <div>
                <dt className="text-xs font-medium text-text-body/60">
                  団体名
                </dt>
                <dd className="text-sm font-medium text-text-dark">
                  {profile.organizationName}
                </dd>
              </div>
            </div>

            {/* 代表者名 */}
            {profile.representativeName && (
              <div className="flex items-start gap-3">
                <User className="mt-0.5 size-4 shrink-0 text-text-body/60" />
                <div>
                  <dt className="text-xs font-medium text-text-body/60">
                    代表者名
                  </dt>
                  <dd className="text-sm text-text-dark">
                    {profile.representativeName}
                  </dd>
                </div>
              </div>
            )}

            {/* 連絡先メールアドレス */}
            {profile.contactEmail && (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 size-4 shrink-0 text-text-body/60" />
                <div>
                  <dt className="text-xs font-medium text-text-body/60">
                    連絡先メールアドレス
                  </dt>
                  <dd className="text-sm text-text-dark">
                    {profile.contactEmail}
                  </dd>
                </div>
              </div>
            )}

            {/* 活動地域 */}
            {profile.activityAreas.length > 0 && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-text-body/60" />
                <div>
                  <dt className="text-xs font-medium text-text-body/60">
                    活動地域
                  </dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {profile.activityAreas.map((area) => (
                      <span
                        key={area}
                        className="rounded-full border border-card-border bg-white px-2.5 py-0.5 text-xs text-text-body"
                      >
                        {area}
                      </span>
                    ))}
                  </dd>
                </div>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* アクションリンク */}
      <div className="mt-8 flex flex-col items-center gap-3">
        {isRejected && (
          <Link
            href="/onboarding/organization"
            className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark"
          >
            申請内容を修正する
          </Link>
        )}
        <Link
          href="/"
          className="flex h-10 items-center gap-2 rounded-lg border border-card-border bg-background px-4 text-sm font-medium text-text-dark hover:bg-primary/5"
        >
          トップページへ戻る
        </Link>
        <PendingActions />
      </div>
    </main>
  );
}

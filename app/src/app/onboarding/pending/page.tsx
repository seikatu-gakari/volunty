import { redirect } from "next/navigation";
import { Clock, Building2, User, Mail, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";

/** 審査待ち画面に表示する団体情報 */
interface PendingOrgProfile {
  organizationName: string;
  representativeName: string | null;
  contactEmail: string | null;
  activityAreas: string[];
}

/** 認証状態・ロール・審査ステータス・団体情報を取得する */
async function getPageState(): Promise<{
  isAuthenticated: boolean;
  isOrganization: boolean;
  isVerified: boolean;
  profile: PendingOrgProfile | null;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        isAuthenticated: false,
        isOrganization: false,
        isVerified: false,
        profile: null,
      };
    }

    const role = user.user_metadata?.role as string | undefined;
    const isOrganization = role === "organization";

    if (!isOrganization) {
      return {
        isAuthenticated: true,
        isOrganization: false,
        isVerified: false,
        profile: null,
      };
    }

    const orgProfile = await prisma.organizationProfile.findUnique({
      where: { userId: user.id },
      select: {
        organizationName: true,
        representativeName: true,
        contactEmail: true,
        activityAreas: true,
        verified: true,
      },
    });

    if (!orgProfile) {
      return {
        isAuthenticated: true,
        isOrganization: true,
        isVerified: false,
        profile: null,
      };
    }

    return {
      isAuthenticated: true,
      isOrganization: true,
      isVerified: orgProfile.verified,
      profile: {
        organizationName: orgProfile.organizationName,
        representativeName: orgProfile.representativeName,
        contactEmail: orgProfile.contactEmail,
        activityAreas: Array.isArray(orgProfile.activityAreas)
          ? (orgProfile.activityAreas as string[])
          : [],
      },
    };
  } catch {
    // Supabase 未設定時・DB接続エラー時はスキップ
    return {
      isAuthenticated: false,
      isOrganization: false,
      isVerified: false,
      profile: null,
    };
  }
}

export default async function OnboardingPendingPage() {
  const { isAuthenticated, isOrganization, isVerified, profile } =
    await getPageState();

  if (!isAuthenticated) redirect("/login");
  if (!isOrganization) redirect("/onboarding/role");
  if (!profile) redirect("/onboarding/organization");
  if (isVerified) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      {/* ステータスヘッダー */}
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Clock className="size-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text-dark">審査中です</h1>
        <p className="text-text-body">
          団体登録の申請を受け付けました。管理者が内容を確認しています。
        </p>
        <p className="text-sm text-text-body/80">
          審査には数日かかる場合があります。承認され次第、ダッシュボードへアクセスできるようになります。
        </p>
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
    </main>
  );
}

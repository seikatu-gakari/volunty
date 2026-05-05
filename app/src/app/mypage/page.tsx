import Link from "next/link";
import {
  User,
  MapPin,
  Brain,
  ClipboardList,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { fetchMyPageData } from "@/lib/mypage/actions";
import type { ApplicationStatus } from "@/lib/mypage/types";

/** ステータスに応じたラベル・アイコン・カラー */
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
        label: "マッチング成立",
        icon: <CheckCircle2 className="size-4" />,
        color: "text-green-700 bg-green-50 border-green-200",
      };
    case "rejected":
      return {
        label: "辞退",
        icon: <XCircle className="size-4" />,
        color: "text-red-700 bg-red-50 border-red-200",
      };
  }
}

export default async function MyPage() {
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

  const { profile, applications, alert } = await fetchMyPageData();
  const profileActionHref = profile
    ? "/mypage/profile/edit"
    : "/onboarding/participant";
  const profileActionLabel = profile ? "編集" : "登録";
  const diagnosisActionHref = profile?.diagnosis_scores
    ? "/diagnosis/result"
    : "/diagnosis";
  const diagnosisActionLabel = profile?.diagnosis_scores
    ? "診断結果を見る"
    : "性格診断を受ける";

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-8 text-2xl font-bold text-text-dark">マイページ</h1>

        {alert && (
          <div className="mb-6 rounded-[10px] border border-yellow-300 bg-yellow-50 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-yellow-800">
              <AlertTriangle className="size-4" />
              {alert.title}
            </div>
            <p className="text-sm text-yellow-900">{alert.message}</p>
            <p className="mt-2 wrap-break-word text-xs text-yellow-800">{alert.detail}</p>
          </div>
        )}

        {/* プロフィールセクション */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <User className="size-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-text-dark">プロフィール</h2>
              </div>
              <Link
                href={profileActionHref}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Pencil className="size-4" />
                {profileActionLabel}
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {profile ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-text-body" />
                  <span className="text-sm text-text-body">名前</span>
                  <span className="ml-auto text-sm font-medium text-text-dark">
                    {profile.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-text-body" />
                  <span className="text-sm text-text-body">希望地域</span>
                  <span className="ml-auto text-sm font-medium text-text-dark">
                    {profile.region || "未設定"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Brain className="size-4 text-text-body" />
                  <span className="text-sm text-text-body">診断結果</span>
                  <span className="ml-auto text-sm font-medium text-text-dark">
                    {profile.diagnosis_type || "未受診"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-body">
                プロフィール情報はまだ登録されていません。
              </p>
            )}
          </CardContent>
        </Card>

        {/* アクションリンク */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href={diagnosisActionHref}
            className="flex items-center gap-3 rounded-[10px] border border-card-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <Brain className="size-5 text-primary" />
            <span className="text-sm font-medium text-text-dark">
              {diagnosisActionLabel}
            </span>
          </Link>
          <Link
            href="/recommendations"
            className="flex items-center gap-3 rounded-[10px] border border-card-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <Search className="size-5 text-primary" />
            <span className="text-sm font-medium text-text-dark">
              おすすめ案件を探す
            </span>
          </Link>
        </div>

        {/* 応募一覧セクション */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <ClipboardList className="size-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-text-dark">応募一覧</h2>
            </div>
          </CardHeader>
          <CardContent>
            {applications.length > 0 ? (
              <div className="flex flex-col gap-4">
                {applications.map((app) => {
                  const display = statusDisplay(app.status);
                  return (
                    <div
                      key={app.id}
                      className="rounded-lg border border-card-border p-4"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            <h3 className="text-sm font-medium text-text-dark">
                              {app.opportunity.title}
                            </h3>
                            <p className="text-xs text-text-body">
                              {app.opportunity.organization_name}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${display.color}`}
                          >
                            {display.icon}
                            {display.label}
                          </span>
                        </div>

                        {/* マッチング成立時のみ LINE ID を表示 */}
                        {app.status === "approved" &&
                          app.opportunity.organization_line_id && (
                            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3">
                              <MessageCircle className="size-4 text-green-700" />
                              <div className="flex flex-col">
                                <span className="text-xs text-green-700">
                                  団体連絡先（LINE ID）
                                </span>
                                <span className="text-sm font-medium text-green-800">
                                  {app.opportunity.organization_line_id}
                                </span>
                              </div>
                            </div>
                          )}

                        <p className="text-xs text-text-body">
                          応募日:{" "}
                          {new Date(app.created_at).toLocaleDateString("ja-JP")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <ClipboardList className="size-10 text-text-body/30" />
                <p className="text-sm text-text-body">
                  まだ応募した案件はありません。
                </p>
                <Link
                  href="/recommendations"
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Search className="size-4" />
                  おすすめ案件を探す
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

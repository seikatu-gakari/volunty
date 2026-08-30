import Link from "next/link";
import {
  User,
  MapPin,
  Brain,
  ArrowRight,
  ClipboardList,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Pencil,
  AlertTriangle,
  Inbox,
  FileCheck2,
  Bookmark,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { fetchMyPageData } from "@/lib/mypage/actions";
import type { ApplicationStatus } from "@/lib/mypage/types";
import { formatDateInJapan } from "@/lib/date/format-date";
import { applicationStatusLabel } from "@/lib/mypage/status";
import { DeleteAccountForm } from "./DeleteAccountForm";
import { isAccountDeletionEnabled } from "@/lib/account-deletion/config";

/** ステータスに応じたラベル・アイコン・カラー */
function statusDisplay(status: ApplicationStatus) {
  switch (status) {
    case "pending":
      return {
        label: applicationStatusLabel(status),
        icon: <Clock className="size-4" />,
        color: "text-yellow-700 bg-yellow-50 border-yellow-200",
      };
    case "approved":
      return {
        label: applicationStatusLabel(status),
        icon: <CheckCircle2 className="size-4" />,
        color: "text-green-700 bg-green-50 border-green-200",
      };
    case "completed":
      return {
        label: applicationStatusLabel(status),
        icon: <CheckCircle2 className="size-4" />,
        color: "text-primary bg-primary/10 border-primary/20",
      };
    case "rejected":
      return {
        label: applicationStatusLabel(status),
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
  const diagnosisActionHref = profile?.diagnosis_completed
    ? "/diagnosis/result"
    : null;

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
                <div className="flex items-start gap-2">
                  <Brain className="mt-0.5 size-4 shrink-0 text-text-body" />
                  <span className="shrink-0 text-sm text-text-body">診断結果</span>
                  <div className="ml-auto text-right">
                    <span className="text-sm font-medium text-text-dark">
                      {profile.diagnosis_completed
                        ? (profile.diagnosis_style_type_label ?? "診断済み")
                        : "未受診"}
                    </span>
                    {profile.diagnosis_completed && profile.diagnosis_answered_at && (
                      <p className="mt-0.5 text-xs text-text-body">
                        {new Intl.DateTimeFormat("sv-SE", {
                          timeZone: "Asia/Tokyo",
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                          .format(new Date(profile.diagnosis_answered_at))
                          .replace("T", " ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-body">
                プロフィール情報はまだ登録されていません。
              </p>
            )}
          </CardContent>
        </Card>

        {profile && !profile.diagnosis_completed && (
          <section
            aria-labelledby="diagnosis-start-title"
            className="mb-8 flex flex-col gap-4"
          >
            <h2
              id="diagnosis-start-title"
              className="text-lg font-bold text-text-dark"
            >
              性格傾向チェックを始める
            </h2>
            <Link
              href="/diagnosis"
              className="group flex flex-col gap-4 rounded-[10px] border border-primary/30 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <Brain className="size-8 text-primary" />
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-text-dark">
                    性格傾向チェック
                  </h3>
                  <p className="text-sm text-text-body">
                    簡易診断（15問・約2分）/ 全50問（約5〜8分）から選べます
                  </p>
                </div>
              </div>
              <ul className="flex flex-col gap-2">
                {[
                  "世界中で使われている性格研究をもとに設計",
                  "5つの性格特性の傾向を確認",
                  "おすすめ案件の並び順の参考になります",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-primary" />
                    <span className="text-sm text-text-dark">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
                診断を始める
                <ArrowRight className="size-4" />
              </div>
            </Link>
          </section>
        )}

        {/* アクションリンク */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {diagnosisActionHref && (
            <Link
              href={diagnosisActionHref}
              className="flex items-center gap-3 rounded-[10px] border border-card-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <Brain className="size-5 text-primary" />
              <span className="text-sm font-medium text-text-dark">
                診断結果を見る
              </span>
            </Link>
          )}
          <Link
            href="/recommendations"
            className="flex items-center gap-3 rounded-[10px] border border-card-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <Search className="size-5 text-primary" />
            <span className="text-sm font-medium text-text-dark">
              おすすめ案件を探す
            </span>
          </Link>
          <Link
            href="/mypage/approaches"
            className="flex items-center gap-3 rounded-[10px] border border-card-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <Inbox className="size-5 text-primary" />
            <span className="text-sm font-medium text-text-dark">
              受信アプローチを見る
            </span>
          </Link>
          <Link
            href="/mypage/bookmarks"
            className="flex items-center gap-3 rounded-[10px] border border-card-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <Bookmark className="size-5 text-primary" />
            <span className="text-sm font-medium text-text-dark">
              後で見る案件
            </span>
          </Link>
          <Link
            href="/mypage/certificates"
            className="flex items-center gap-3 rounded-[10px] border border-card-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <FileCheck2 className="size-5 text-primary" />
            <span className="text-sm font-medium text-text-dark">
              参加証明書を見る
            </span>
          </Link>
        </div>

        {/* 応募一覧セクション */}
        <Card className="mb-8">
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
                      className="rounded-lg border border-card-border p-4 transition-shadow hover:shadow-md"
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

                        {/* マッチング成立後のみ LINE ID を表示 */}
                        {(app.status === "approved" ||
                          app.status === "completed") &&
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
                          応募日: {formatDateInJapan(app.created_at)}
                        </p>
                        {app.completed_at && (
                          <p className="text-xs text-text-body">
                            完了日: {formatDateInJapan(app.completed_at)}
                          </p>
                        )}
                        {app.can_request_certificate && (
                          <Link
                            href={`/mypage/certificates/request/${app.id}`}
                            className="inline-flex w-fit items-center gap-2 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
                          >
                            <FileCheck2 className="size-4" />
                            証明書を申請
                          </Link>
                        )}
                        <Link
                          href={`/mypage/applications/${app.id}`}
                          className="inline-flex w-fit items-center gap-2 text-xs font-medium text-primary hover:underline"
                        >
                          詳細を見る
                        </Link>
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

        {/* アカウント削除 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="size-5 text-red-700" />
              </div>
              <h2 className="text-lg font-bold text-text-dark">アカウント削除</h2>
            </div>
          </CardHeader>
          <CardContent>
            <DeleteAccountForm enabled={isAccountDeletionEnabled()} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

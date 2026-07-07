import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  User,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicantDetail } from "@/lib/dashboard/actions";
import { StatusActions } from "../../components/StatusActions";

export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string; applicationId: string }>;
}) {
  const { id, applicationId } = await params;

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

  const { data, error } = await fetchApplicantDetail(applicationId);

  if (!data) {
    if (error === "ログインが必要です") {
      redirect("/login");
    }
    notFound();
  }

  const typeDetail = data.style_type_detail;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* 戻るリンク */}
        <Link
          href={`/dashboard/opportunities/${id}`}
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          応募者一覧に戻る
        </Link>

        {/* 応募者ヘッダー */}
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="size-6 text-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <h1 className="text-xl font-bold text-text-dark">
                    {data.participant_name}
                  </h1>
                  {data.style_type_label && (
                    <span className="text-sm text-text-body">
                      {data.style_type_label}（参考タイプ）
                    </span>
                  )}
                </div>
              </div>
              <StatusActions
                applicationId={data.id}
                currentStatus={data.status}
              />
            </div>

            {/* 案件名・応募日 */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-text-body/70">
              <span>
                案件: {data.opportunity_title}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                応募日:{" "}
                {new Date(data.created_at).toLocaleDateString("ja-JP")}
              </span>
              {data.completed_at && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3" />
                  完了日:{" "}
                  {new Date(data.completed_at).toLocaleDateString("ja-JP")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 応募メッセージ */}
        {data.message && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                <h3 className="text-lg font-bold text-text-dark">
                  応募メッセージ
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap leading-relaxed text-text-body">
                {data.message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 活動スタイルの参考タイプ（生の診断スコアは開示しない） */}
        {typeDetail ? (
          <div className="mb-6 space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-bold text-text-dark">
                  活動スタイル（参考タイプ）
                </h3>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <h4 className="text-base font-bold text-primary">
                    {typeDetail.name}
                  </h4>
                  <p className="text-xs text-text-body">
                    {typeDetail.nameEn}
                  </p>
                </div>
                <p className="leading-relaxed text-text-body">
                  {typeDetail.description}
                </p>
                <p className="mt-3 text-xs leading-5 text-text-body">
                  ※ 参加者の回答傾向にもとづく参考情報です。選考の合否判定に用いるものではありません。
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-bold text-text-dark">
                  発揮しやすい傾向の例
                </h3>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {typeDetail.tendencies.map((tendency, i) => (
                    <li key={i} className="flex items-center text-text-body">
                      <span className="mr-2 text-primary">•</span>
                      {tendency}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-lg font-bold text-text-dark">
                  力を発揮しやすい活動の例
                </h3>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {typeDetail.activityExamples.map((activity, i) => (
                    <li key={i} className="flex items-center text-text-body">
                      <span className="mr-2 text-primary">•</span>
                      {activity}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* 診断未実施 */
          <Card className="mb-6">
            <CardContent>
              <p className="text-center text-sm text-text-body">
                この応募者はまだ性格診断を実施していません。
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

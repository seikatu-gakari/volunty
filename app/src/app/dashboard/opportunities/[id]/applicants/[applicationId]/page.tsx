import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  User,
  MessageSquare,
  Sparkles,
  Clock,
} from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { fetchApplicantDetail } from "@/lib/dashboard/actions";
import { StatusActions } from "../../components/StatusActions";

/** BIG5 スコアバー */
function ScoreBar({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-sm font-medium text-text-body">{label}</span>
        <span className="text-sm font-bold text-text-dark">{score}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-primary/20">
        <div
          className={`h-2.5 rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

/** BIG5 スコア一覧セクション */
function ScoresSection({
  scores,
}: {
  scores: Record<string, number>;
}) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-bold text-text-dark">BIG5 スコア詳細</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <ScoreBar
            label="外向性"
            score={scores.extraversion ?? 0}
            color="bg-red-500"
          />
          <ScoreBar
            label="協調性"
            score={scores.agreeableness ?? 0}
            color="bg-green-500"
          />
          <ScoreBar
            label="誠実性"
            score={scores.conscientiousness ?? 0}
            color="bg-blue-500"
          />
          <ScoreBar
            label="神経症傾向"
            score={scores.neuroticism ?? 0}
            color="bg-yellow-500"
          />
          <ScoreBar
            label="開放性"
            score={scores.openness ?? 0}
            color="bg-purple-500"
          />
        </div>
        <div className="mt-6 rounded-lg bg-background p-4 text-xs text-text-body">
          <p>※ スコアは0-100で表示されています。</p>
          <p>
            ※ 神経症傾向は数値が高いほど「敏感・繊細」であることを示します。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

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

  const typeDetail = data.personality_type_detail;

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
                  {data.diagnosis_type && (
                    <span className="text-sm text-text-body">
                      {data.diagnosis_type}
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
            </div>
          </CardContent>
        </Card>

        {/* マッチングスコア */}
        {data.match_score !== null && (
          <Card className="mb-6">
            <CardContent>
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-primary" />
                <span className="text-sm font-medium text-text-body">
                  マッチングスコア
                </span>
                <span className="text-2xl font-bold text-text-dark">
                  {data.match_score}%
                </span>
              </div>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full ${
                    data.match_score >= 80
                      ? "bg-primary"
                      : data.match_score >= 60
                        ? "bg-primary-dark"
                        : "bg-text-body"
                  }`}
                  style={{ width: `${data.match_score}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* 診断タイプ詳細 + BIG5 スコア */}
        {typeDetail ? (
          <div className="mb-6 grid gap-6 md:grid-cols-2">
            {/* 左カラム: タイプ詳細 */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-bold text-text-dark">
                    診断タイプ
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="text-lg font-bold text-text-dark">
                    ボランティアでの強み
                  </h3>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {typeDetail.strengths.map((strength, i) => (
                      <li key={i} className="flex items-center text-text-body">
                        <span className="mr-2 text-primary">•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="text-lg font-bold text-text-dark">
                    適した活動
                  </h3>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {typeDetail.suitableActivities.map((activity, i) => (
                      <li key={i} className="flex items-center text-text-body">
                        <span className="mr-2 text-primary">•</span>
                        {activity}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* 右カラム: BIG5 スコア */}
            {data.diagnosis_scores && (
              <ScoresSection scores={data.diagnosis_scores} />
            )}
          </div>
        ) : data.diagnosis_scores ? (
          /* 診断タイプが不明だがスコアがある場合 */
          <div className="mb-6">
            <ScoresSection scores={data.diagnosis_scores} />
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchDiagnosisResult } from "@/lib/diagnosis/actions";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import type { BIG5Scores } from "@/lib/personality/types";

/** BIG5 スコアバー（サーバーコンポーネント） */
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

/** BIG5 スコア一覧 */
function ScoreSection({ scores }: { scores: BIG5Scores }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-bold text-text-dark">BIG5 スコア詳細</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <ScoreBar
            label="外向性"
            score={scores.extraversion}
            color="bg-red-500"
          />
          <ScoreBar
            label="協調性"
            score={scores.agreeableness}
            color="bg-green-500"
          />
          <ScoreBar
            label="誠実性"
            score={scores.conscientiousness}
            color="bg-blue-500"
          />
          <ScoreBar
            label="神経症傾向"
            score={scores.neuroticism}
            color="bg-yellow-500"
          />
          <ScoreBar
            label="開放性"
            score={scores.openness}
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

/**
 * 診断結果ページ（/diagnosis/result）
 *
 * アクセス条件:
 * - ログイン済み（未ログイン → /login へリダイレクト）
 * - 診断済み（未診断 → /diagnosis へリダイレクト）
 */
export default async function DiagnosisResultPage() {
  // 認証チェック
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error("[DiagnosisResultPage] Supabase接続エラー:", err);
  }

  if (!user) {
    redirect("/login");
  }

  const result = await fetchDiagnosisResult();

  // 診断未実施の場合は /diagnosis へリダイレクト
  if (!result) {
    redirect("/diagnosis");
  }

  const { personalityType: type, scores, isExactMatch } = result;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* タイトル・タイプ名 */}
        <Card className="mb-6">
          <CardContent className="py-10 text-center">
            <h2 className="mb-4 text-2xl font-bold text-text-dark">
              診断結果
            </h2>
            <div className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
              {isExactMatch ? "完全一致" : "最も近いタイプ"}
            </div>
            <h1 className="mb-2 text-4xl font-extrabold text-primary">
              {type.name}
            </h1>
            <p className="text-lg font-medium text-text-body">{type.nameEn}</p>
          </CardContent>
        </Card>

        {/* 詳細セクション */}
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          {/* 左カラム: 特徴・強み・適した活動 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-bold text-text-dark">特徴</h3>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-text-body">
                  {type.description}
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
                  {type.strengths.map((strength, i) => (
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
                  {type.suitableActivities.map((activity, i) => (
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
          <ScoreSection scores={scores} />
        </div>

        {/* アクションボタン */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/recommendations"
            className="flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-white hover:bg-primary-dark"
          >
            <Search className="size-5" />
            おすすめ案件を見る
          </Link>
          <Link
            href="/diagnosis"
            className="flex h-11 items-center gap-2 rounded-lg border border-card-border bg-white px-8 text-sm font-medium text-text-dark hover:bg-background"
          >
            <RefreshCw className="size-5" />
            再診断する
          </Link>
        </div>
      </main>
    </div>
  );
}

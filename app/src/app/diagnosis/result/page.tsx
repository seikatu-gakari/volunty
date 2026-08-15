import Link from "next/link";
import { redirect } from "next/navigation";
import { RefreshCw, Search, Info, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchDiagnosisResult } from "@/lib/diagnosis/actions";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import {
  BIG5_DOMAINS,
  BIG5_DOMAIN_LABELS,
  BIG5_DOMAIN_DESCRIPTIONS,
} from "@/lib/diagnosis-scale/types";
import type { Big5Domain, DomainScores, QualityFlag } from "@/lib/diagnosis-scale/types";

const DOMAIN_COLORS: Record<Big5Domain, string> = {
  extraversion: "bg-red-500",
  agreeableness: "bg-green-500",
  conscientiousness: "bg-blue-500",
  emotionalStability: "bg-yellow-500",
  intellect: "bg-purple-500",
};

/** scaleCode ごとの表示名・注記（新しい尺度を追加する場合はここに登録する） */
const SCALE_DISPLAY_INFO: Record<string, { label: string; briefNotice?: string }> = {
  "ipip-bfm-50-ja": { label: "性格傾向チェック（全50問）による診断" },
  "legacy-big5": { label: "旧版の性格診断による診断" },
  "ipip-bfm-50-ja-brief15": {
    label: "性格傾向チェック（簡易15問）による診断",
    briefNotice:
      "簡易診断（15問）は全50問版から項目を抜粋したものです。項目数が少ないぶん結果の安定性は下がるため、より参考になる結果を得たい場合は全50問診断もお試しください。",
  },
};

const QUALITY_FLAG_MESSAGES: Record<QualityFlag, string> = {
  too_fast:
    "回答時間が短めでした。結果が実際の傾向とずれている可能性があります。落ち着いて再診断すると、より参考になる結果が得られます。",
  straight_lining:
    "同じ選択肢が長く続いていました。結果が実際の傾向とずれている可能性があります。再診断をおすすめします。",
  inconsistent:
    "内容の近い質問への回答にばらつきが見られました。結果は参考程度に見てください。",
};

/** ドメインスコアバー（サーバーコンポーネント） */
function ScoreBar({
  domain,
  score,
}: {
  domain: Big5Domain;
  score: number;
}) {
  const rounded = Math.round(score);
  const description =
    score >= 60
      ? BIG5_DOMAIN_DESCRIPTIONS[domain].high
      : score <= 40
        ? BIG5_DOMAIN_DESCRIPTIONS[domain].low
        : "どちらの場面にも合わせやすい中間的な傾向";
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-sm font-medium text-text-body">
          {BIG5_DOMAIN_LABELS[domain]}
        </span>
        <span className="text-sm font-bold text-text-dark">{rounded}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-primary/20">
        <div
          className={`h-2.5 rounded-full ${DOMAIN_COLORS[domain]}`}
          style={{ width: `${rounded}%` }}
        />
      </div>
      <p className="mt-1 text-xs leading-5 text-text-body">{description}</p>
    </div>
  );
}

/** ドメインスコア一覧 */
function ScoreSection({ scores }: { scores: DomainScores }) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-bold text-text-dark">5つの性格特性スコア</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {BIG5_DOMAINS.map((domain) => (
            <ScoreBar key={domain} domain={domain} score={scores[domain]} />
          ))}
        </div>
        <div className="mt-6 rounded-lg bg-background p-4 text-xs leading-5 text-text-body">
          <p>
            ※ スコアはあなたの回答を0〜100に換算したもので、「他の人の中での順位」や「上位◯%」を表すものではありません。
          </p>
          <p>※ 性格に良し悪しはなく、どの傾向にも活きる場面があります。</p>
          <p>※ 自己報告に基づく結果のため、±数点程度の揺らぎがあります。</p>
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

  const { scaledScores, styleType, qualityFlags, answeredAt, scaleCode } = result;
  const answeredDate = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(answeredAt));
  const scaleDisplay = SCALE_DISPLAY_INFO[scaleCode] ?? SCALE_DISPLAY_INFO["ipip-bfm-50-ja"];

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* タイトル */}
        <Card className="mb-6">
          <CardContent className="py-10 text-center">
            <h1 className="mb-4 text-2xl font-bold text-text-dark">診断結果</h1>
            {styleType && (
              <>
                <div className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                  あなたに近い活動スタイル（参考）
                </div>
                <h2 className="mb-2 text-4xl font-extrabold text-primary">
                  {styleType.name}
                </h2>
                <p className="text-lg font-medium text-text-body">
                  {styleType.nameEn}
                </p>
              </>
            )}
            <p className="mx-auto mt-4 max-w-xl text-xs leading-5 text-text-body">
              {scaleDisplay.label} / 実施日: {answeredDate}
            </p>
          </CardContent>
        </Card>

        {/* 簡易診断の注記 */}
        {scaleDisplay.briefNotice && (
          <div className="mb-6 rounded-[10px] border border-primary/30 bg-primary/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-text-dark">
              <Info className="size-4 text-primary" />
              簡易診断について
            </div>
            <p className="text-xs leading-5 text-text-body">{scaleDisplay.briefNotice}</p>
          </div>
        )}

        {/* 回答品質の注記 */}
        {qualityFlags.length > 0 && (
          <div className="mb-6 rounded-[10px] border border-yellow-300 bg-yellow-50 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-yellow-800">
              <AlertTriangle className="size-4" />
              回答について
            </div>
            <ul className="space-y-1 text-xs leading-5 text-yellow-900">
              {qualityFlags.map((flag) => (
                <li key={flag}>{QUALITY_FLAG_MESSAGES[flag]}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-yellow-800">
              この注記は回答のしかたに関するもので、あなたの性格の評価ではありません。
            </p>
          </div>
        )}

        {/* 詳細セクション */}
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          {/* 左カラム: 参考タイプの説明 */}
          <div className="space-y-6">
            {styleType && (
              <>
                <Card>
                  <CardHeader>
                    <h3 className="text-lg font-bold text-text-dark">傾向</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="leading-relaxed text-text-body">
                      あなたの回答は「{styleType.name}」に近い傾向がありました。
                      {styleType.description}。
                    </p>
                    <p className="mt-3 text-xs leading-5 text-text-body">
                      ※ タイプ分類は結果を分かりやすくするための参考情報で、5つのスコアが診断の本体です。
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
                      {styleType.tendencies.map((tendency, i) => (
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
                      {styleType.activityExamples.map((activity, i) => (
                        <li key={i} className="flex items-center text-text-body">
                          <span className="mr-2 text-primary">•</span>
                          {activity}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs leading-5 text-text-body">
                      ※ あくまで傾向にもとづく例です。どの活動にも応募できます。
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* 右カラム: ドメインスコア */}
          <ScoreSection scores={scaledScores} />
        </div>

        {/* この結果について */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="size-4 text-primary" />
              <h3 className="text-lg font-bold text-text-dark">この結果について</h3>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-xs leading-5 text-text-body">
              <li>・この診断は自己報告に基づく性格の傾向を確認するもので、医療・心理臨床の診断ではありません。</li>
              <li>・おすすめ案件の並び順は、興味分野・地域・日程などを主に、性格の傾向も一部参考にして決まります。性格を理由に応募できなくなることはありません。</li>
              <li>・回答はその時の状態で変わることがあります。再診断すると最新の結果がマッチングに使われます。</li>
              <li>・質問項目は国際的に公開されている性格研究にもとづいており、測定の精度は現在も検証を続けています。</li>
            </ul>
          </CardContent>
        </Card>

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

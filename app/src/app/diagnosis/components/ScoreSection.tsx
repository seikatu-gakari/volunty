import { ACTIVITY_STYLE_THRESHOLDS } from "@/lib/diagnosis-scale/activity-styles";
import {
  BIG5_DOMAINS,
  BIG5_DOMAIN_LABELS,
  BIG5_DOMAIN_DESCRIPTIONS,
} from "@/lib/diagnosis-scale/types";
import type { Big5Domain, DomainScores } from "@/lib/diagnosis-scale/types";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";

const DOMAIN_COLORS: Record<Big5Domain, string> = {
  extraversion: "bg-red-500",
  agreeableness: "bg-green-500",
  conscientiousness: "bg-blue-500",
  emotionalStability: "bg-yellow-500",
  intellect: "bg-purple-500",
};

/** 回答から求めたスコアと方向を示すバー。 */
function ScoreBar({
  domain,
  score,
}: {
  domain: Big5Domain;
  score: number;
}) {
  const displayed = Number(score.toFixed(1));
  const description =
    score >= 50 + ACTIVITY_STYLE_THRESHOLDS.neutralDeviation
      ? BIG5_DOMAIN_DESCRIPTIONS[domain].high
      : score <= 50 - ACTIVITY_STYLE_THRESHOLDS.neutralDeviation
        ? BIG5_DOMAIN_DESCRIPTIONS[domain].low
        : "今回の回答では、どちらの方向も際立たない中間域です";
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-sm font-medium text-text-body">
          {BIG5_DOMAIN_LABELS[domain]}
        </span>
        <span className="text-sm font-bold text-text-dark">{displayed}</span>
      </div>
      <div
        role="meter"
        aria-label={BIG5_DOMAIN_LABELS[domain]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className="h-2.5 w-full rounded-full bg-primary/20"
      >
        <div
          className={`h-2.5 rounded-full ${DOMAIN_COLORS[domain]}`}
          style={{ width: `${displayed}%` }}
        />
      </div>
      <p className="mt-1 text-xs leading-5 text-text-body">{description}</p>
    </div>
  );
}

/** ドメインスコア一覧 */
export function ScoreSection({ scores }: { scores: DomainScores }) {
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
          <p>※ 自己報告に基づく結果のため、その時の状態や回答によってスコアは変わることがあります。</p>
        </div>
      </CardContent>
    </Card>
  );
}

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { OpportunityRecommendation } from "@/lib/recommendations/types"

interface OpportunityCardProps {
  recommendation: OpportunityRecommendation
}

/**
 * おすすめ案件一覧の各カード。
 * クリックすると /opportunities/:id の案件詳細ページへ遷移する。
 */
export function OpportunityCard({ recommendation }: OpportunityCardProps) {
  const { id, title, description, organizationName, matchScore } = recommendation

  // マッチングスコアに応じてバーの色を切り替える
  const scoreColor =
    matchScore >= 80
      ? "bg-primary"
      : matchScore >= 60
        ? "bg-primary-dark"
        : "bg-text-body"

  return (
    <Link
      href={`/opportunities/${id}`}
      className="group flex flex-col gap-4 rounded-[10px] border border-card-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* ヘッダー行: タイトル + マッチングスコア */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold leading-tight text-text-dark group-hover:text-primary">
            {title}
          </h3>
          <p className="text-sm text-text-body">{organizationName}</p>
        </div>

        {/* マッチングスコアバッジ */}
        <div className="flex shrink-0 flex-col items-center">
          <span className="text-2xl font-bold leading-none text-text-dark">
            {matchScore}
          </span>
          <span className="text-xs text-text-body">%</span>
        </div>
      </div>

      {/* マッチングスコアプログレスバー */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${scoreColor} transition-all`}
          style={{ width: `${matchScore}%` }}
        />
      </div>

      {/* 案件の簡易説明 */}
      {description && (
        <p className="line-clamp-2 text-sm leading-5 text-text-body">
          {description}
        </p>
      )}

      {/* 詳細リンク */}
      <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
        詳細を見る
        <ArrowRight className="size-4" />
      </div>
    </Link>
  )
}

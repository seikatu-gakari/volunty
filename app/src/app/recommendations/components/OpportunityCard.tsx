import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import type { OpportunityRecommendation } from "@/lib/recommendations/types"

interface OpportunityCardProps {
  recommendation: OpportunityRecommendation
}

/**
 * おすすめ案件一覧の各カード。
 * クリックすると /opportunities/:id の案件詳細ページへ遷移する。
 * 旧「マッチ度◯%」の表示は廃止し、日本語の推薦理由チップで説明する。
 */
export function OpportunityCard({ recommendation }: OpportunityCardProps) {
  const { id, title, description, organizationName, reasons, recommendationLogId } =
    recommendation

  const detailHref = recommendationLogId
    ? `/opportunities/${id}?from=rec&rlog=${recommendationLogId}`
    : `/opportunities/${id}?from=rec`

  return (
    <Link
      href={detailHref}
      className="group flex flex-col gap-4 rounded-[10px] border border-card-border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* ヘッダー行: タイトル・団体名 */}
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold leading-tight text-text-dark group-hover:text-primary">
          {title}
        </h3>
        <p className="text-sm text-text-body">{organizationName}</p>
      </div>

      {/* 推薦理由チップ */}
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {reasons.map((reason) => (
            <span
              key={reason}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              <Sparkles className="size-3" />
              {reason}
            </span>
          ))}
        </div>
      )}

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

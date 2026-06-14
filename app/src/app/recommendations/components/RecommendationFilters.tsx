import Link from "next/link"
import { Search, X } from "lucide-react"
import type { RecommendationFilters as RecommendationFiltersType } from "@/lib/recommendations/types"

const CATEGORY_OPTIONS = [
  "環境保全",
  "地域活動",
  "教育",
  "子ども支援",
  "居場所づくり",
  "IT支援",
  "高齢者支援",
  "障がい者サポート",
]

interface RecommendationFiltersProps {
  filters: RecommendationFiltersType
}

/**
 * おすすめ案件一覧のカテゴリ・地域フィルタ。
 * GET パラメータで絞り込み条件をページへ渡す。
 */
export function RecommendationFilters({ filters }: RecommendationFiltersProps) {
  return (
    <form
      method="get"
      className="mb-6 grid gap-4 rounded-[10px] border border-card-border bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="category"
          className="text-sm font-medium text-text-dark"
        >
          カテゴリ
        </label>
        <select
          id="category"
          name="category"
          defaultValue={filters.category ?? ""}
          className="h-11 rounded-lg border border-input-border bg-white px-3 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">すべて</option>
          {CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="region" className="text-sm font-medium text-text-dark">
          地域
        </label>
        <input
          id="region"
          name="region"
          type="text"
          defaultValue={filters.region ?? ""}
          placeholder="例: 渋谷区、東京都、オンライン"
          className="h-11 rounded-lg border border-input-border bg-white px-3 text-sm text-text-dark placeholder:text-text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark sm:flex-none"
        >
          <Search className="size-4" />
          絞り込む
        </button>
        <Link
          href="/recommendations"
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-card-border px-4 text-sm font-medium text-text-body hover:bg-background"
        >
          <X className="size-4" />
          クリア
        </Link>
      </div>
    </form>
  )
}

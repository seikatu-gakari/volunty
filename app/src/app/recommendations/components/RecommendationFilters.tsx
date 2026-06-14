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

const REGION_OPTIONS = [
  "渋谷区",
  "新宿区",
  "世田谷区",
  "練馬区",
  "杉並区",
  "中野区",
  "豊島区",
  "品川区",
  "港区",
  "千代田区",
  "中央区",
  "台東区",
  "墨田区",
  "江東区",
  "目黒区",
  "大田区",
  "板橋区",
  "足立区",
  "葛飾区",
  "江戸川区",
  "八王子市",
  "町田市",
  "立川市",
  "三鷹市",
  "武蔵野市",
  "東京都",
]

const PARTICIPATION_MODE_OPTIONS = [
  { value: "online", label: "オンライン" },
  { value: "offline", label: "オフライン" },
] as const

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
      className="mb-6 grid gap-4 rounded-[10px] border border-card-border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
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
        <select
          id="region"
          name="region"
          defaultValue={filters.region ?? ""}
          className="h-11 rounded-lg border border-input-border bg-white px-3 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">すべて</option>
          {REGION_OPTIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="participationMode"
          className="text-sm font-medium text-text-dark"
        >
          参加形態
        </label>
        <select
          id="participationMode"
          name="participationMode"
          defaultValue={filters.participationMode ?? ""}
          className="h-11 rounded-lg border border-input-border bg-white px-3 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">すべて</option>
          {PARTICIPATION_MODE_OPTIONS.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
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

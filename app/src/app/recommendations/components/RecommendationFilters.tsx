"use client"

import Link from "next/link"
import { Loader2, Search, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FormEvent, type MouseEvent, useRef, useTransition } from "react"
import type { RecommendationFilters as RecommendationFiltersType } from "@/lib/recommendations/types"
import { CATEGORY_OPTIONS } from "@/lib/opportunities/constants"

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

interface SearchableFilters {
  category: string
  region: string
  participationMode: string
}

function readStringFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

const FILTER_KEYS = ["category", "region", "participationMode"] as const

function createFilterQuery(filters: SearchableFilters) {
  const params = new URLSearchParams()

  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value === "") continue
    params.set(key, value)
  }

  return params.toString()
}

/**
 * おすすめ案件一覧のカテゴリ・地域フィルタ。
 * GET パラメータで絞り込み条件をページへ渡す。
 */
export function RecommendationFilters({ filters }: RecommendationFiltersProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const currentQuery = createFilterQuery({
    category: filters.category ?? "",
    region: filters.region ?? "",
    participationMode: filters.participationMode ?? "",
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending) return

    const formData = new FormData(event.currentTarget)
    const nextFilters = {
      category: readStringFormValue(formData, "category"),
      region: readStringFormValue(formData, "region"),
      participationMode: readStringFormValue(formData, "participationMode"),
    }

    const query = createFilterQuery(nextFilters)
    if (query === currentQuery) return

    startTransition(() => {
      router.push(query ? `/recommendations?${query}` : "/recommendations")
    })
  }

  function handleClear(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    if (isPending) return

    formRef.current?.reset()
    if (currentQuery === "") return

    startTransition(() => {
      router.push("/recommendations")
    })
  }

  return (
    <form
      key={currentQuery}
      ref={formRef}
      aria-label="おすすめ案件フィルター"
      aria-busy={isPending}
      method="get"
      onSubmit={handleSubmit}
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
          disabled={isPending}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-wait disabled:opacity-80 sm:flex-none"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {isPending ? "検索中" : "絞り込む"}
        </button>
        <Link
          href="/recommendations"
          onClick={handleClear}
          aria-disabled={isPending}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-card-border px-4 text-sm font-medium text-text-body hover:bg-background aria-disabled:pointer-events-none aria-disabled:opacity-60"
        >
          <X className="size-4" />
          クリア
        </Link>
      </div>
    </form>
  )
}

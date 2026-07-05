import { redirect } from "next/navigation"
import Link from "next/link"
import { Brain, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { fetchRecommendations } from "@/lib/recommendations/actions"
import type { RecommendationFilters } from "@/lib/recommendations/types"
import { Header } from "@/app/components/Header"
import { OpportunityCard } from "./components/OpportunityCard"
import { RecommendationFilters as RecommendationFiltersForm } from "./components/RecommendationFilters"

type RecommendationsPageProps = {
  searchParams?: Promise<{
    category?: string | string[]
    region?: string | string[]
    participationMode?: string | string[]
  }>
}

function pickSearchParam(value?: string | string[]): string | undefined {
  const param = Array.isArray(value) ? value[0] : value
  const trimmed = param?.trim()
  return trimmed ? trimmed : undefined
}

function pickParticipationMode(
  value?: string | string[]
): RecommendationFilters["participationMode"] | undefined {
  const param = pickSearchParam(value)
  return param === "online" || param === "offline" ? param : undefined
}

/**
 * おすすめ案件一覧ページ
 *
 * アクセス条件:
 * - ログイン済み（未ログイン → /login へリダイレクト）
 * - 診断済み（未診断 → 診断を促すメッセージを表示）
 */
export default async function RecommendationsPage({
  searchParams,
}: RecommendationsPageProps) {
  const params = await searchParams
  const filters: RecommendationFilters = {
    category: pickSearchParam(params?.category),
    region: pickSearchParam(params?.region),
    participationMode: pickParticipationMode(params?.participationMode),
  }
  const hasActiveFilters = Boolean(
    filters.category || filters.region || filters.participationMode
  )

  // 認証チェック
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    // Supabase未設定・接続エラー時は未ログインとして扱う
    console.error("[RecommendationsPage] Supabase接続エラー:", err)
  }

  if (!user) {
    redirect("/login")
  }

  const { recommendations, hasCompletedDiagnosis } =
    await fetchRecommendations(filters)

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* ページタイトル */}
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-text-dark">おすすめ案件</h1>
          <p className="text-sm text-text-body">
            興味分野・地域・日程などをもとに、性格の傾向も一部参考にして並べています。
            性格だけでおすすめを決めることはありません。
          </p>
        </div>

        <RecommendationFiltersForm filters={filters} />

        {/* 診断未実施の場合の案内（未診断でもおすすめは表示される） */}
        {!hasCompletedDiagnosis && (
          <div className="mb-6 flex items-center gap-4 rounded-[10px] border border-card-border bg-white px-6 py-4 shadow-sm">
            <Brain className="size-8 shrink-0 text-primary" />
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-medium text-text-dark">
                性格診断を受けると、あなたの傾向もおすすめの参考に加わります
              </p>
              <p className="text-xs text-text-body">
                診断を受けなくても案件の閲覧・応募はできます。
              </p>
            </div>
            <Link
              href="/diagnosis"
              className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-primary px-4 text-xs font-medium text-white hover:bg-primary-dark"
            >
              <Sparkles className="size-4" />
              診断を始める
            </Link>
          </div>
        )}

        {/* 案件がない場合 */}
        {recommendations.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-[10px] border border-card-border bg-white px-8 py-12 text-center shadow-sm">
            <p className="text-base text-text-body">
              {hasActiveFilters
                ? "条件に一致する案件はありません。カテゴリや地域を変更して再度お試しください。"
                : "現在公開中の案件はありません。しばらくしてから再度ご確認ください。"}
            </p>
          </div>
        )}

        {/* おすすめ案件一覧 */}
        {recommendations.length > 0 && (
          <div className="flex flex-col gap-4">
            {recommendations.map((recommendation) => (
              <OpportunityCard
                key={recommendation.id}
                recommendation={recommendation}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

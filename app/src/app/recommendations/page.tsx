import { redirect } from "next/navigation"
import Link from "next/link"
import { Brain, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { fetchRecommendations } from "@/lib/recommendations/actions"
import { Header } from "@/app/components/Header"
import { OpportunityCard } from "./components/OpportunityCard"

/**
 * おすすめ案件一覧ページ
 *
 * アクセス条件:
 * - ログイン済み（未ログイン → /login へリダイレクト）
 * - 診断済み（未診断 → 診断を促すメッセージを表示）
 */
export default async function RecommendationsPage() {
  // 認証チェック
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase未設定・接続エラー時は未ログインとして扱う
  }

  if (!user) {
    redirect("/login")
  }

  const { recommendations, hasCompletedDiagnosis } =
    await fetchRecommendations()

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* ページタイトル */}
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-text-dark">おすすめ案件</h1>
          <p className="text-sm text-text-body">
            あなたの性格特性に合ったボランティア活動をご提案します
          </p>
        </div>

        {/* 診断未実施の場合 */}
        {!hasCompletedDiagnosis && (
          <div className="flex flex-col items-center gap-6 rounded-[10px] border border-card-border bg-white px-8 py-12 text-center shadow-sm">
            <Brain className="size-16 text-primary" />
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-text-dark">
                まずは性格診断を受けましょう
              </h2>
              <p className="text-sm leading-6 text-text-body">
                あなたに合ったボランティア活動を提案するために、
                <br />
                BIG5 性格診断を実施してください。
              </p>
            </div>
            <Link
              href="/diagnosis"
              className="flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Sparkles className="size-5" />
              診断を始める
            </Link>
          </div>
        )}

        {/* 診断済みだが案件がない場合 */}
        {hasCompletedDiagnosis && recommendations.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-[10px] border border-card-border bg-white px-8 py-12 text-center shadow-sm">
            <p className="text-base text-text-body">
              現在公開中の案件はありません。しばらくしてから再度ご確認ください。
            </p>
          </div>
        )}

        {/* おすすめ案件一覧 */}
        {hasCompletedDiagnosis && recommendations.length > 0 && (
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

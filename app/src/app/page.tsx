import Link from "next/link";
import {
  Heart,
  Sparkles,
  Zap,
  Brain,
  ArrowRight,
  Target,
} from "lucide-react";
import { Header } from "./components/Header";
import { AuthenticatedHome } from "./components/AuthenticatedHome";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase未設定・接続エラー時はログインなしで表示
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ヘッダー */}
      <Header />

      {/* 認証済みユーザーは専用ホーム画面を表示 */}
      {user && <AuthenticatedHome user={user} />}

      {/* 未ログインユーザー向けランディングページ */}
      {!user && (
        <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-20 sm:px-6 lg:px-8">
          {/* ヒーローセクション */}
          <section className="relative overflow-hidden rounded-3xl bg-white px-6 py-16 text-center shadow-sm sm:px-12 sm:py-24 animate-[fade-in-up_0.8s_ease-out_forwards]">
            <div className="absolute top-0 left-1/2 -z-10 -ml-40 h-[400px] w-[800px] -translate-x-1/2 animate-pulse rounded-full bg-primary/5 blur-3xl" />
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 flex justify-center gap-3">
                <span className="inline-flex animate-[float_6s_ease-in-out_infinite] items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-dark">
                  <Brain className="size-4" /> 本格性格診断
                </span>
                <span className="inline-flex animate-[float_6s_ease-in-out_1s_infinite] items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-dark">
                  <Target className="size-4" /> 相性スコア
                </span>
                <span className="inline-flex animate-[float_6s_ease-in-out_2s_infinite] items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-dark">
                  <Sparkles className="size-4" /> AI分析
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-text-dark sm:text-5xl lg:text-6xl">
                つながる、みつかる、
                <span className="text-primary">変わっていく</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-text-body">
                独自の性格診断アルゴリズムを用いて、あなたの特性や強みを診断。相性スコアとAI分析が、あなたに最も適したボランティア活動への第一歩をサポートします。
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/diagnosis?mode=brief"
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-background px-8 text-base font-bold text-text-dark transition-all hover:bg-white sm:w-auto"
                >
                  <Zap className="size-5 text-primary" />
                  16問 簡易診断
                  <span className="ml-1 text-xs font-normal opacity-75">
                    約2分
                  </span>
                </Link>
                <Link
                  href="/diagnosis?mode=full"
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 text-base font-bold text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg sm:w-auto"
                >
                  <Brain className="size-5" />
                  60問 詳細診断
                  <span className="ml-1 text-xs font-normal opacity-75">
                    約8〜10分
                  </span>
                  <ArrowRight className="ml-2 size-5" />
                </Link>
              </div>
            </div>
          </section>

          {/* 3大機能の紹介 */}
          <section className="mt-24">
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-dark">
                あなたらしさを活かす3つの機能
              </h2>
            </div>
            <div className="grid gap-10 lg:grid-cols-3">
              <div className="group relative flex flex-col items-start gap-6 rounded-2xl border border-card-border bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
                <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                  <Brain className="size-7 text-primary-dark" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-dark">性格診断</h3>
                  <p className="mt-4 text-base leading-7 text-text-body">
                    独自の性格診断アルゴリズムを採用。さまざまな特徴からあなたを全10種類のパーソナルタイプに分類し、隠れた強みを引き出します。
                  </p>
                </div>
                <div className="mt-auto w-full rounded-xl bg-background p-4 text-sm text-text-dark transition-colors duration-300 group-hover:bg-primary/5">
                  <div className="mb-2 font-medium">10類型の中のいくつかの例:</div>
                  <ul className="flex flex-wrap gap-2">
                    <li className="rounded bg-white px-2 py-1 shadow-sm transition-transform hover:scale-105">イノベーター・リーダー</li>
                    <li className="rounded bg-white px-2 py-1 shadow-sm transition-transform hover:scale-105">サポーター・ケア</li>
                    <li className="rounded bg-white px-2 py-1 shadow-sm transition-transform hover:scale-105">クリエイティブ・ソロ</li>
                  </ul>
                </div>
              </div>

              <div className="group relative flex flex-col items-start gap-6 rounded-2xl border border-card-border bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl" style={{ animationDelay: "100ms" }}>
                <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                  <Heart className="size-7 text-primary-dark" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-dark">相性マッチング</h3>
                  <p className="mt-4 text-base leading-7 text-text-body">
                    分析結果と、募集団体が求める人物像を照らし合わせ、独自の相性スコア（0〜100）を算出。膨大な募集案件の中から、あなたに最もフィットする活動をスコア順にご提案します。
                  </p>
                </div>
                <div className="mt-auto w-full rounded-xl bg-background p-4 text-sm text-text-dark transition-colors duration-300 group-hover:bg-primary/5">
                  <div className="flex items-center justify-between rounded bg-white px-3 py-2 shadow-sm transition-transform hover:scale-105">
                    <span className="font-medium">こども食堂の運営サポート</span>
                    <span className="font-bold text-primary">スコア 95</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded bg-white px-3 py-2 shadow-sm transition-transform hover:scale-105">
                    <span className="font-medium">地域イベントの準備・運営</span>
                    <span className="font-bold text-primary">スコア 82</span>
                  </div>
                </div>
              </div>

              <div className="group relative flex flex-col items-start gap-6 rounded-2xl border border-card-border bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl" style={{ animationDelay: "200ms" }}>
                <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 transition-transform duration-300 group-hover:scale-110 group-hover:bg-primary/20">
                  <Sparkles className="size-7 text-primary-dark" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-dark">AI分析による言語化</h3>
                  <p className="mt-4 text-base leading-7 text-text-body">
                    診断データや活動候補の理由をAIが分析。単なる数値での提案にとどまらず、なぜその活動が適しているのか、あなたのどのような特性が活きるのかをわかりやすく解説します。
                  </p>
                </div>
                <div className="mt-auto w-full rounded-xl bg-background p-4 text-sm text-text-dark transition-colors duration-300 group-hover:bg-primary/5">
                  <p className="italic text-text-body">
                    「あなたの高い『協調性』と『誠実性』は、チームで協力しながら着実にタスクを進める地域イベントの運営において、大きな強みとなります。」
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 体験フロー */}
          <section className="mt-32">
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-text-dark">
                利用の流れ
              </h2>
              <p className="mt-4 text-lg text-text-body">
                3つのステップで、すぐに行動を始めることができます
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="group relative flex flex-col items-center text-center transition-transform duration-300 hover:scale-[1.02]">
                <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-primary font-bold text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl">
                  STEP 1
                </div>
                <h3 className="mb-3 text-xl font-bold text-text-dark">
                  ボランティア診断
                </h3>
                <p className="text-base leading-7 text-text-body">
                  16問または60問の質問に答え、あなたの特性とボランティア適性を明らかにします。
                </p>
                {/* 矢印 (PCのみ) */}
                <ArrowRight className="absolute top-8 -right-4 hidden size-8 text-primary/30 transition-transform duration-300 group-hover:translate-x-2 md:block" />
              </div>
              <div className="group relative flex flex-col items-center text-center transition-transform duration-300 hover:scale-[1.02]" style={{ animationDelay: "100ms" }}>
                <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-primary font-bold text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl">
                  STEP 2
                </div>
                <h3 className="mb-3 text-xl font-bold text-text-dark">
                  AI分析・相性チェック
                </h3>
                <p className="text-base leading-7 text-text-body">
                  診断結果と相性スコアに基づいて、最適化された活動一覧と、AIによる詳細な分析コメントを確認します。
                </p>
                {/* 矢印 (PCのみ) */}
                <ArrowRight className="absolute top-8 -right-4 hidden size-8 text-primary/30 transition-transform duration-300 group-hover:translate-x-2 md:block" />
              </div>
              <div className="group relative flex flex-col items-center text-center transition-transform duration-300 hover:scale-[1.02]" style={{ animationDelay: "200ms" }}>
                <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-text-dark font-bold text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl">
                  STEP 3
                </div>
                <h3 className="mb-3 text-xl font-bold text-text-dark">
                  参加申し込み
                </h3>
                <p className="text-base leading-7 text-text-body">
                  気になる活動が見つかったら、詳細を確認してすぐに応募。同じ志を持つ仲間と一緒に社会に貢献しましょう。
                </p>
              </div>
            </div>
          </section>

          {/* ボトム CTA */}
          <section className="mt-32 rounded-3xl bg-background p-8 text-center sm:p-16">
            <h2 className="text-3xl font-bold tracking-tight text-text-dark">
              早速、あなたの特性を診断してみましょう
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-text-body">
              アカウント登録不要で、すぐに診断を開始できます。
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/diagnosis?mode=brief"
                className="flex h-14 w-full max-w-[280px] items-center justify-center gap-2 rounded-xl border-2 border-primary bg-white px-8 text-base font-bold text-text-dark transition-all hover:bg-gray-50 sm:w-auto"
              >
                <Zap className="size-5 text-primary" />
                16問 簡易診断
              </Link>
              <Link
                href="/diagnosis?mode=full"
                className="flex h-14 w-full max-w-[280px] items-center justify-center gap-2 rounded-xl bg-primary px-8 text-base font-bold text-white shadow-md transition-all hover:bg-primary-dark sm:w-auto"
              >
                <Brain className="size-5" />
                60問 詳細診断
                <ArrowRight className="ml-1 size-5" />
              </Link>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

import Link from "next/link";
import {
  Heart,
  Sparkles,
  Zap,
  Brain,
  ArrowRight,
  Target,
  Users,
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
      {!user && <main className="mx-auto max-w-3xl px-6 pt-6">
        {/* ヒーローセクション */}
        <section className="flex flex-col items-center gap-6 py-12">
          <div className="relative">
            <Heart
              className="size-20 text-primary"
              fill="#fb5b01"
              strokeWidth={0}
            />
            <Sparkles className="absolute -top-2 -right-1 size-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-4xl leading-12 text-text-dark md:text-5xl">
              あなたにぴったりの
              <br />
              <span className="text-primary">ボランティア活動</span>
              を見つけよう
            </h1>
          </div>
          <p className="max-w-xl text-center text-lg leading-7 text-text-body">
            簡単な診断を通じて、あなたの特性に最も適したボランティア活動をご提案します
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/diagnosis?mode=brief"
              className="flex h-11 items-center gap-2 rounded-lg border border-primary bg-background px-8 text-sm font-medium text-text-dark hover:bg-white"
            >
              <Zap className="size-5 text-primary" />
              16問 簡易診断
              <span className="text-xs opacity-75">約2分</span>
            </Link>
            <Link
              href="/diagnosis?mode=full"
              className="flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-white hover:bg-primary-dark"
            >
              <Brain className="size-5" />
              60問 詳細診断
              <span className="text-xs opacity-75">約8〜10分</span>
              <ArrowRight className="size-5" />
            </Link>
          </div>
          <p className="text-center text-sm text-text-body">
            まずは簡易診断でお試しいただき、より詳しく知りたい場合は詳細診断をお試しください
          </p>
        </section>

        {/* 特徴カード */}
        <section className="grid grid-cols-1 gap-6 py-12 md:grid-cols-3">
          {[
            {
              icon: <Target className="size-12 text-primary" />,
              title: "正確なマッチング",
              description:
                "16問の簡易診断や60問の詳細診断により、あなたの特性や志向を分析し、最適なボランティア活動をマッチングします",
            },
            {
              icon: <Users className="size-12 text-primary" />,
              title: "多様な活動",
              description:
                "教育支援、環境保護、災害支援、医療支援など、幅広いジャンルのボランティア活動から選択できます",
            },
            {
              icon: <Heart className="size-12 text-primary" />,
              title: "社会貢献",
              description:
                "あなたの特技や関心を活かして社会に貢献し、同じ志を持つ仲間と出会える機会を提供します",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center gap-4 rounded-[10px] border border-card-border bg-white p-6 shadow-sm"
            >
              <div className="flex h-12 items-center justify-center">
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-text-dark">
                {feature.title}
              </h3>
              <p className="text-center text-sm leading-5 text-text-body">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        {/* 診断の種類 */}
        <section className="flex flex-col items-center gap-8 py-12">
          <h2 className="text-base text-text-dark">診断の種類</h2>
          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
            {/* 簡易診断 */}
            <div className="rounded-[10px] border border-primary/30 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Zap className="size-8 text-primary" />
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-text-dark">
                    16問 簡易診断
                  </h3>
                  <p className="text-sm text-text-body">約2分で完了</p>
                </div>
              </div>
              <ul className="mt-6 flex flex-col gap-2">
                {[
                  "サクッとボランティアタイプを診断",
                  "基本的な特性と傾向を分析",
                  "初めての方におすすめ",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-primary" />
                    <span className="text-sm text-text-dark">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* 詳細診断 */}
            <div className="rounded-[10px] border border-primary-dark/30 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Brain className="size-8 text-primary-dark" />
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-text-dark">
                    60問 詳細診断
                  </h3>
                  <p className="text-sm text-text-body">約8〜10分で完了</p>
                </div>
              </div>
              <ul className="mt-6 flex flex-col gap-2">
                {[
                  "より精密な性格分析",
                  "5つの特性を多角的に分析",
                  "より適切なマッチングを実現",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-primary-dark" />
                    <span className="text-sm text-text-dark">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 利用の流れ */}
        <section className="flex flex-col items-center gap-8 py-12">
          <h2 className="text-base text-text-dark">利用の流れ</h2>
          <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: 1,
                color: "bg-primary",
                title: "ボランティア診断",
                description:
                  "10問または96問の質問に答えて、あなたのボランティアタイプを診断します",
              },
              {
                step: 2,
                color: "bg-primary-dark",
                title: "マッチング",
                description:
                  "診断結果に基づいて、あなたに最適なボランティア活動を提案します",
              },
              {
                step: 3,
                color: "bg-text-dark",
                title: "参加申し込み",
                description:
                  "気になる活動があれば、詳細を確認して参加申し込みができます",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div
                  className={`flex size-12 items-center justify-center rounded-full ${item.color} text-base font-medium text-white`}
                >
                  {item.step}
                </div>
                <h3 className="text-base text-text-dark">{item.title}</h3>
                <p className="text-sm leading-5 text-text-body">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>}
    </div>
  );
}

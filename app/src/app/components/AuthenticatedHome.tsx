import Link from "next/link";
import { Brain, Zap, ArrowRight, Heart, Sparkles } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface AuthenticatedHomeProps {
  user: User;
}

export function AuthenticatedHome({ user }: AuthenticatedHomeProps) {
  const displayName =
    user.user_metadata?.full_name ?? user.email ?? "ゲスト";

  return (
    <main className="mx-auto max-w-3xl px-6 pt-6">
      {/* ウェルカムセクション */}
      <section className="flex flex-col items-center gap-6 py-12">
        <div className="relative">
          <Heart
            className="size-16 text-primary"
            fill="#fb5b01"
            strokeWidth={0}
          />
          <Sparkles className="absolute -top-2 -right-1 size-6 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-base text-text-body">おかえりなさい</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight text-text-dark">
            {displayName}さん
          </h1>
        </div>
        <p className="max-w-md text-center text-base leading-7 text-text-body">
          性格診断を通じて、あなたに最適なボランティア活動を見つけましょう
        </p>
      </section>

      {/* 診断カードセクション */}
      <section className="flex flex-col gap-6 py-6">
        <h2 className="text-base font-medium text-text-dark">性格診断を始める</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 簡易診断 */}
          <Link
            href="/diagnosis?mode=brief"
            className="group flex flex-col gap-4 rounded-[10px] border border-primary/30 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <Zap className="size-8 text-primary" />
              <div>
                <h3 className="text-xl font-bold tracking-tight text-text-dark">
                  16問 簡易診断
                </h3>
                <p className="text-sm text-text-body">約2分で完了</p>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
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
            <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
              診断を始める
              <ArrowRight className="size-4" />
            </div>
          </Link>

          {/* 詳細診断 */}
          <Link
            href="/diagnosis?mode=full"
            className="group flex flex-col gap-4 rounded-[10px] border border-primary-dark/30 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <Brain className="size-8 text-primary-dark" />
              <div>
                <h3 className="text-xl font-bold tracking-tight text-text-dark">
                  60問 詳細診断
                </h3>
                <p className="text-sm text-text-body">約8〜10分で完了</p>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
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
            <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary-dark group-hover:underline">
              診断を始める
              <ArrowRight className="size-4" />
            </div>
          </Link>
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
                "16問の簡易診断または60問の詳細診断で、あなたのボランティアタイプを診断します",
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
    </main>
  );
}

import Link from "next/link";
import { Brain, ArrowRight, Heart, Sparkles } from "lucide-react";
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
          あなたの興味や傾向に合ったボランティア活動を見つけましょう
        </p>
      </section>

      {/* 診断カードセクション */}
      <section className="flex flex-col gap-6 py-6">
        <h2 className="text-base font-medium text-text-dark">性格傾向チェックを始める</h2>
        <Link
          href="/diagnosis"
          className="group flex flex-col gap-4 rounded-[10px] border border-primary/30 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <Brain className="size-8 text-primary" />
            <div>
              <h3 className="text-xl font-bold tracking-tight text-text-dark">
                性格傾向チェック
              </h3>
              <p className="text-sm text-text-body">
                簡易診断（15問・約2分）/ 全50問（約5〜8分）から選べます
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {[
              "世界中で使われている性格研究をもとに設計",
              "5つの性格特性の傾向を確認",
              "おすすめ案件の並び順の参考になります",
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
      </section>

      {/* 利用の流れ */}
      <section className="flex flex-col items-center gap-8 py-12">
        <h2 className="text-base text-text-dark">利用の流れ</h2>
        <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-3">
          {[
            {
              step: 1,
              color: "bg-primary",
              title: "性格傾向チェック",
              description:
                "簡易診断（15問）または全50問の質問で、5つの性格特性の傾向を確認します",
            },
            {
              step: 2,
              color: "bg-primary-dark",
              title: "マッチング",
              description:
                "興味分野・地域・日程などをもとに、性格の傾向も参考にしておすすめを表示します",
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

import { Heart, Sparkles } from "lucide-react";
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

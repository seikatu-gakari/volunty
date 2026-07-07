import Link from "next/link";
import { Zap, Brain } from "lucide-react";

export function LPBottomCTA() {
  return (
    <section className="relative z-10 mt-20 overflow-hidden rounded-3xl bg-linear-to-br from-primary-light via-primary to-primary-dark p-8 text-center text-white shadow-xl sm:mt-28 sm:p-14">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -left-16 size-80 rounded-full bg-white/10 blur-3xl" aria-hidden />

      <p className="mb-3 text-sm font-medium text-white/80">まずは5分、無料で</p>
      <h2 className="text-3xl font-bold tracking-tight sm:text-[34px]">
        あなたにぴったりの活動を、<br className="sm:hidden" />今日、見つけよう。
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/90">
        簡易診断（15問）や全50問の性格傾向チェックから、新しいつながりとちいさな達成感が始まります。
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link
          href="/diagnosis"
          className="flex h-14 w-full max-w-[300px] items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-bold text-primary-dark shadow-md transition-all hover:shadow-xl sm:w-auto"
        >
          <Zap className="size-5" />
          性格傾向チェックを始める
        </Link>
        <Link
          href="/opportunities"
          className="flex h-14 w-full max-w-[300px] items-center justify-center gap-2 rounded-full border-2 border-white px-8 text-base font-bold text-white transition-all hover:bg-white/10 sm:w-auto"
        >
          <Brain className="size-5" />
          募集中の活動を見る
        </Link>
      </div>
    </section>
  );
}

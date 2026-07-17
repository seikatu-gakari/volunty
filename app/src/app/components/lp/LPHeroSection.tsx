import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, Clock3, Smartphone } from "lucide-react";
import { HeroPhotoOrbit } from "./HeroPhotoOrbit";

const TRUST_ITEMS = [
  { icon: CheckCircle2, text: "登録・診断は無料" },
  { icon: Clock3, text: "約2分でできる" },
  { icon: Smartphone, text: "スマホ・PC対応" },
] as const;

export function LPHeroSection() {
  return (
    <section className="relative z-10 -mx-4 overflow-hidden bg-lp-cream px-4 py-8 sm:-mx-6 sm:px-6 sm:py-12 lg:mx-0 lg:rounded-[40px] lg:px-10 lg:py-16">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-x-12 lg:gap-y-7">
        <div className="relative z-10 lg:col-start-1 lg:row-start-1">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-pop-teal/25 bg-pop-teal-soft px-4 py-2 text-xs font-bold text-text-dark shadow-sm sm:text-sm">
            <Brain className="size-4 text-pop-teal" aria-hidden />
            性格傾向 × ボランティアマッチング
          </p>

          <h1
            aria-label="つながる、みつかる、変わっていく。"
            className="text-[clamp(2.85rem,13vw,4.75rem)] leading-[1.2] font-black tracking-[-0.045em] text-text-dark lg:text-[clamp(3.25rem,4.5vw,4.5rem)]"
          >
            <span className="block">つながる<span className="text-primary">、</span></span>
            <span className="block">みつかる<span className="text-pop-teal">、</span></span>
            <span className="block">変わっていく<span className="text-pop-purple">。</span></span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-8 font-medium text-text-body sm:text-lg">
            約2分の簡易診断と興味分野から、あなたに合う活動を見つけよう。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-start-1 lg:row-start-2">
          <Link
            href="/diagnosis/trial"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary-dark px-6 text-base font-bold text-white shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-text-dark"
          >
            無料で簡易診断を試す
            <ArrowRight className="size-5" aria-hidden />
          </Link>
          <Link
            href="/opportunities"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-primary-dark bg-white px-6 text-base font-bold text-primary-dark transition-colors hover:bg-primary/5 hover:text-text-dark"
          >
            募集中の活動を見る
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        </div>

        <HeroPhotoOrbit />

        <div className="grid grid-cols-3 divide-x divide-card-border rounded-2xl bg-white/85 px-2 py-4 shadow-sm ring-1 ring-card-border lg:col-start-1 lg:row-start-3">
          {TRUST_ITEMS.map((item) => (
            <div key={item.text} className="flex min-w-0 flex-col items-center gap-1.5 px-1 text-center">
              <item.icon className="size-5 text-text-body" aria-hidden />
              <span className="text-[11px] leading-4 font-medium text-text-body sm:text-xs">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

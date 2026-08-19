import Link from "next/link";
import { ArrowRight, Brain, CheckCircle2, Clock3, Smartphone } from "lucide-react";
import { HeroPhotoFrame } from "./HeroPhotoFrame";

const TRUST_ITEMS = [
  { icon: CheckCircle2, text: "登録・診断は無料" },
  { icon: Clock3, text: "約2分でできる" },
  { icon: Smartphone, text: "スマホ対応", desktopText: "スマホ・PC対応" },
] as const;

export function LPHeroSection() {
  return (
    <section className="relative z-10 -mx-4 overflow-hidden bg-lp-cream px-6 py-3 sm:-mx-6 sm:px-8 sm:py-8 lg:mx-0 lg:rounded-none lg:px-4 lg:pt-10 lg:pb-16 xl:-mx-8 xl:px-[10px]">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-x-16 lg:gap-y-7 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] xl:gap-x-32">
        <p className="relative top-0 mb-1 inline-flex w-fit items-center gap-2 self-start rounded-full border border-pop-teal/25 bg-pop-teal-soft px-3 py-1.5 text-xs font-bold text-text-dark shadow-sm sm:text-sm lg:col-start-1 lg:row-start-1 lg:mb-4 lg:top-8 lg:px-5">
          <Brain className="size-4 text-pop-teal" aria-hidden />
          性格傾向 × ボランティアマッチング
        </p>

        <h1
          aria-label="つながる、みつかる、変わっていく。"
          className="relative top-0 text-[clamp(2.6rem,12vw,4.75rem)] leading-[1.12] font-black tracking-[-0.045em] text-text-dark lg:col-start-1 lg:row-start-2 lg:top-8 lg:text-[clamp(3.5rem,4.5vw,4.5rem)]"
        >
          <span className="block lg:whitespace-nowrap">
            つながる<span className="text-primary">、</span>
          </span>
          <span className="block lg:whitespace-nowrap">
            みつかる<span className="text-pop-teal">、</span>
          </span>
          <span className="block lg:whitespace-nowrap">
            変わっていく<span className="text-pop-purple">。</span>
          </span>
        </h1>

        <p className="relative top-0 mt-1 max-w-xl text-sm leading-7 font-medium text-text-body sm:text-base lg:col-start-1 lg:row-start-3 lg:mt-2 lg:top-12 lg:text-lg lg:leading-8">
          約2分の簡易診断で、あなたらしく続けやすい活動のヒントを見つけよう。
        </p>

        <div className="lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:-mt-8 lg:flex lg:items-start">
          <HeroPhotoFrame />
        </div>

        <div className="relative top-0 grid w-full gap-1.5 lg:col-start-1 lg:row-start-4 lg:top-12 lg:flex lg:flex-row lg:items-stretch lg:gap-3 lg:justify-start xl:gap-4">
          <Link
            href="/diagnosis/trial"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-base font-bold text-white shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-primary-dark lg:h-12 lg:w-auto lg:flex-[2_1_0%] lg:min-w-0 lg:px-3 lg:text-sm lg:whitespace-nowrap xl:h-14 xl:w-[320px] xl:flex-none xl:px-6 xl:text-base"
          >
            2分で自分の活動タイプを知る
            <ArrowRight className="size-5" aria-hidden />
          </Link>
          <Link
            href="#styles"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary-dark bg-white px-6 text-base font-bold text-primary-dark transition-colors hover:bg-primary/5 hover:text-text-dark lg:h-12 lg:w-auto lg:flex-1 lg:min-w-0 lg:px-3 lg:text-sm lg:whitespace-nowrap xl:h-14 xl:w-[220px] xl:flex-none xl:px-6 xl:text-base"
          >
            活動例を見る
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        </div>

        <div
          data-testid="lp-hero-assurance"
          className="relative top-0 grid w-full grid-cols-3 divide-x divide-card-border rounded-2xl bg-white/85 px-2 py-4 shadow-sm ring-1 ring-card-border lg:col-start-1 lg:row-start-5 lg:top-12 lg:w-[575px]"
        >
          {TRUST_ITEMS.map((item) => (
            <div key={item.text} className="flex min-w-0 flex-col items-center gap-1.5 px-1 text-center">
              <item.icon className="size-5 text-text-body" aria-hidden />
              <span className="text-[11px] leading-4 font-medium text-text-body sm:text-xs">
                <span className={"desktopText" in item ? "lg:hidden" : undefined}>
                  {item.text}
                </span>
                {"desktopText" in item && (
                  <span className="hidden lg:inline">{item.desktopText}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

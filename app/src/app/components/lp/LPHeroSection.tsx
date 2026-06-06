import Link from "next/link";
import { Brain, Target, Sparkles, Zap, ArrowRight, CheckCircle, Clock, Smartphone } from "lucide-react";

export function LPHeroSection() {
  return (
    <section className="relative overflow-hidden rounded-4xl bg-white px-6 py-14 shadow-sm sm:px-12 sm:py-20 animate-[fade-in-up_0.8s_ease-out_forwards]">
      <div className="absolute top-0 left-1/2 -z-10 -ml-40 h-[400px] w-[800px] -translate-x-1/2 animate-pulse rounded-full bg-primary/5 blur-3xl" />
      <svg
        aria-hidden
        className="pointer-events-none absolute right-6 top-6 hidden text-primary/30 sm:block"
        width="120" height="120" viewBox="0 0 120 120" fill="currentColor"
      >
        {Array.from({ length: 6 }).map((_, r) =>
          Array.from({ length: 6 }).map((__, c) => (
            <circle key={`${r}-${c}`} cx={10 + c * 20} cy={10 + r * 20} r={2} />
          ))
        )}
      </svg>

      <div className="relative mx-auto max-w-3xl text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary-dark">
          <Brain className="size-4" />
          AI × 性格診断 × ボランティア
        </div>

        <div className="mb-6 flex flex-wrap justify-center gap-3">
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
          <span className="bg-linear-to-r from-primary to-primary-dark bg-clip-text text-transparent">
            変わっていく。
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-text-body">
          「何から始めればいい？」をAIが解決。約2分の性格診断で、あなたの"得意"にぴったりのボランティアが見つかります。
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/diagnosis?mode=brief"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 text-base font-bold text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg sm:w-auto"
          >
            <Zap className="size-5" />
            16問でサクッと診断
            <span className="ml-1 text-xs font-normal opacity-75">約2分・無料</span>
            <ArrowRight className="ml-1 size-5" />
          </Link>
          <Link
            href="/diagnosis?mode=full"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-background px-8 text-base font-bold text-text-dark transition-all hover:bg-white sm:w-auto"
          >
            60問の詳細診断
            <span className="ml-1 text-xs font-normal opacity-75">約8〜10分</span>
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-text-body">
          {[
            { icon: CheckCircle, text: "登録・診断は無料" },
            { icon: Clock, text: "約2分でできる" },
            { icon: Smartphone, text: "スマホ・PC対応" },
          ].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <item.icon className="size-4 text-primary" />
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

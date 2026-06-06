import { Brain, Sparkles, Target } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: Brain,
    title: "性格診断",
    desc: "16〜60問の質問で、あなたの価値観・適性・強みを数値で可視化します。",
    color: "bg-orange-100 text-orange-600",
  },
  {
    num: "02",
    icon: Sparkles,
    title: "AI分析",
    desc: "診断結果と活動特性をAIが分析し、相性の良い活動を自動で推薦します。",
    color: "bg-purple-100 text-purple-600",
  },
  {
    num: "03",
    icon: Target,
    title: "相性スコア",
    desc: "「どれくらい合うか」を一目で。続けられる活動から無理なく始められます。",
    color: "bg-green-100 text-green-600",
  },
];

export function HowItWorksSection() {
  return (
    <section id="shikumi" className="glass-card relative z-10 mt-20 overflow-hidden rounded-3xl p-8 ring-1 ring-white/60 sm:mt-28 sm:p-12">
      <div className="lp-blob -top-12 -right-12 size-72 bg-primary/20" aria-hidden />
      <div className="lp-blob -bottom-16 -left-16 size-72 bg-[#fbb672]/30" aria-hidden />

      <div className="mb-10 text-center">
        <p className="mb-3 text-sm font-medium text-primary">✦ Voluntyの仕組み ✦</p>
        <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
          性格を知ることが、<br className="sm:hidden" />ぴったりの活動への近道。
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-text-body">
          3つのステップで「あなたに合う」を見つけます。診断 → AI分析 → 相性スコア。
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={i} className="relative flex flex-col items-center text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-dark text-xl font-bold text-white shadow-lg">
              {step.num}
            </div>
            {i < 2 && (
              <div className="absolute top-8 left-[calc(50%+32px)] hidden h-0.5 w-[calc(100%-64px)] bg-primary/20 md:block" />
            )}
            <span className={`mb-4 flex size-14 items-center justify-center rounded-2xl ${step.color}`}>
              <step.icon className="size-7" />
            </span>
            <h3 className="text-lg font-bold text-text-dark">{step.title}</h3>
            <p className="mt-3 max-w-[260px] text-sm leading-6 text-text-body">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

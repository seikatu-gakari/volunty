import { Brain, Search, MessageCircle, Calendar } from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "性格診断・AI分析",
    desc: "独自アルゴリズムで特性や強みを可視化し、ぴったりの活動を提案します。",
  },
  {
    icon: Search,
    title: "スカウトマッチング",
    desc: "あなたに興味を持った団体からスカウトが届く、双方向のマッチング。",
  },
  {
    icon: MessageCircle,
    title: "メッセージ機能",
    desc: "気になる団体と直接やり取り。不安をなくしてから参加できます。",
  },
  {
    icon: Calendar,
    title: "活動管理・記録",
    desc: "参加した活動を記録・管理。小さな実績がきちんと積み上がります。",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative z-10 mt-20 sm:mt-28">
      <div className="mb-12 text-center">
        <p className="mb-3 text-sm font-medium text-primary">✦ 主な機能 ✦</p>
        <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
          続けやすさまで、まるごと設計。
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-text-body">
          出会うだけで終わらない。安心して参加し、実績を積み上げられる機能がそろっています。
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded-2xl border border-card-border bg-white p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <item.icon className="size-8" />
            </span>
            <h3 className="text-lg font-bold text-text-dark">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-text-body">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

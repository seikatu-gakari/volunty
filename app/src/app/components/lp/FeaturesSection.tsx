import { Brain, Search, MessageCircle, Calendar } from "lucide-react";
import { LPSectionHeading } from "./LPSectionHeading";

const FEATURES = [
  {
    icon: Brain,
    title: "性格傾向マッチング",
    desc: "興味分野・地域・日程に性格の傾向も組み合わせて、あなたに合う順に活動を提案します。",
  },
  {
    icon: Search,
    title: "双方向アプローチ",
    desc: "あなたに興味を持った団体からアプローチが届く、双方向のマッチング。",
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
    <section id="features" className="py-20 sm:py-28">
      <LPSectionHeading
        eyebrow="主な機能"
        title="続けやすさまで、まるごと設計。"
        description="出会うだけで終わらない。安心して参加し、実績を積み上げられる機能がそろっています。"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((item, i) => (
          <div
            key={i}
            className="flex flex-col rounded-[28px] border border-card-border bg-white p-6 shadow-sm"
          >
            <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <item.icon className="size-6" aria-hidden />
            </span>
            <h3 className="text-lg font-black text-text-dark">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-text-body">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

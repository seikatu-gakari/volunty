import { ClipboardList, Search, Handshake } from "lucide-react";
import { LPSectionHeading } from "./LPSectionHeading";

const STEPS = [
  {
    num: "1",
    label: "STEP 1",
    icon: ClipboardList,
    title: "性格傾向チェック・登録",
    desc: "世界中で使われている性格研究をもとに、5つの性格特性の傾向を確認。簡易15問（約2分）と全50問（約5〜8分）から選べて、登録は無料です。",
    color: "bg-linear-to-br from-orange-50 to-amber-100 text-primary",
  },
  {
    num: "2",
    label: "STEP 2",
    icon: Search,
    title: "マッチング",
    desc: "興味分野・地域・日程を主に、性格の傾向も一部参考にして、あなたに合う順に活動を表示。団体からアプローチが届くことも。",
    color: "bg-linear-to-br from-purple-50 to-violet-100 text-purple-600",
  },
  {
    num: "3",
    label: "STEP 3",
    icon: Handshake,
    title: "参加・つながり",
    desc: "「なぜおすすめなのか」の理由を確認して、納得してから応募。参加の先に、新しい仲間や小さな承認体験が待っています。",
    color: "bg-linear-to-br from-green-50 to-emerald-100 text-green-600",
  },
];

export function UsageSection() {
  return (
    <section
      id="usage"
      className="glass-card relative z-10 mt-20 overflow-hidden rounded-3xl p-8 ring-1 ring-white/60 sm:mt-28 sm:p-12"
    >
      <div className="lp-blob -top-12 -right-12 size-72 bg-primary/20" aria-hidden />
      <div className="lp-blob -bottom-16 -left-16 size-72 bg-primary-light/30" aria-hidden />

      <LPSectionHeading
        eyebrow="使い方"
        title="はじめるのは、かんたん3ステップ。"
        description="自分の傾向を知ることが、合う活動への近道。登録から参加まで、最短でその日のうちに。"
      />

      <div className="grid gap-8 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={i} className="relative flex flex-col items-center text-center">
            <div className="mb-2 text-xs font-bold text-primary">{step.label}</div>
            <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-dark text-xl font-extrabold text-white shadow-md">
              {step.num}
            </div>
            {i < 2 && (
              <div className="absolute top-9 left-[calc(50%+28px)] hidden h-0.5 w-[calc(100%-56px)] bg-primary/20 md:block" />
            )}
            <span
              className={`mb-4 flex size-14 items-center justify-center rounded-2xl ${step.color}`}
            >
              <step.icon className="size-7" />
            </span>
            <h3 className="text-lg font-bold text-text-dark">{step.title}</h3>
            <p className="mt-3 max-w-[280px] text-sm leading-6 text-text-body">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

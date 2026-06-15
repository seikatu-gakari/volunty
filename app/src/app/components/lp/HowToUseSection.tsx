import { ClipboardList, Search, Handshake } from "lucide-react";

const STEPS = [
  {
    num: "1",
    label: "STEP 1",
    icon: ClipboardList,
    title: "診断・登録",
    desc: "16問の簡易診断または60問の詳細診断で、あなたの特性や興味を診断。登録は無料です。",
    color: "bg-orange-100 text-orange-600",
  },
  {
    num: "2",
    label: "STEP 2",
    icon: Search,
    title: "マッチング",
    desc: "AIが相性スコア順に活動を提案。団体からスカウトが届くことも。",
    color: "bg-primary/10 text-primary",
  },
  {
    num: "3",
    label: "STEP 3",
    icon: Handshake,
    title: "参加・つながり",
    desc: "気になる活動に参加して、新しい仲間や「小さな承認体験」を。",
    color: "bg-green-100 text-green-600",
  },
];

export function HowToUseSection() {
  return (
    <section id="usage" className="relative z-10 mt-20 sm:mt-28">
      <div className="mb-12 text-center">
        <p className="mb-3 text-sm font-medium text-primary">✦ 使い方 ✦</p>
        <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
          はじめるのは、かんたん3ステップ。
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-text-body">
          登録から参加まで、最短でその日のうちに。
        </p>
      </div>

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

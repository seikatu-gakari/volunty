import { Users, Star, TrendingUp } from "lucide-react";
import { LPSectionHeading } from "./LPSectionHeading";

const BENEFITS = [
  {
    icon: Users,
    title: "気楽な雰囲気で交流",
    desc: "普段接点のない人と、自然に会話できる場。肩ひじ張らずに。",
    color: "bg-linear-to-br from-blue-50 to-sky-100 text-blue-600",
  },
  {
    icon: Star,
    title: "小さな承認体験",
    desc: "「ありがとう」と言われる瞬間。目に見える手ごたえがある。",
    color: "bg-linear-to-br from-amber-50 to-yellow-100 text-amber-600",
  },
  {
    icon: TrendingUp,
    title: "目に見える成果",
    desc: "自己成長やつながりが、記録として少しずつ積み上がる。",
    color: "bg-linear-to-br from-green-50 to-emerald-100 text-green-600",
  },
];

export function BenefitsSection() {
  return (
    <section className="relative z-10 mt-20 sm:mt-28">
      <LPSectionHeading
        eyebrow="参加して、変わっていく"
        title="義務じゃない。楽しいから続く。"
        description="交流、小さな承認、目に見える成果。Voluntyのボランティアは、自分のための時間にもなります。"
      />

      <div className="grid gap-6 sm:grid-cols-3">
        {BENEFITS.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded-3xl border border-card-border bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
          >
            <span className={`mb-5 flex size-16 items-center justify-center rounded-2xl ${item.color}`}>
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

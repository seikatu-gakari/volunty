import { Users, Star, TrendingUp } from "lucide-react";

const BENEFITS = [
  {
    icon: Users,
    title: "気楽な雰囲気で交流",
    desc: "普段接点のない人と、自然に会話できる場。肩ひじ張らずに。",
    color: "bg-blue-100 text-blue-600",
  },
  {
    icon: Star,
    title: "小さな承認体験",
    desc: "「ありがとう」と言われる瞬間。目に見える手ごたえがある。",
    color: "bg-yellow-100 text-yellow-600",
  },
  {
    icon: TrendingUp,
    title: "目に見える成果",
    desc: "自己成長やつながりが、記録として少しずつ積み上がる。",
    color: "bg-green-100 text-green-600",
  },
];

export function BenefitsSection() {
  return (
    <section className="relative z-10 mt-20 sm:mt-28">
      <div className="mb-12 text-center">
        <p className="mb-3 text-sm font-medium text-primary">✦ 参加して、変わっていく ✦</p>
        <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
          義務じゃない。楽しいから続く。
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-text-body">
          交流、小さな承認、目に見える成果。Voluntyのボランティアは、自分のための時間にもなります。
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {BENEFITS.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded-2xl border border-card-border bg-white p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
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

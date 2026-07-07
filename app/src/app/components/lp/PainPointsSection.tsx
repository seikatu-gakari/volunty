import { Search, Info, Users, MapPin, ArrowRight, CheckCircle } from "lucide-react";
import { LPSectionHeading } from "./LPSectionHeading";

const PAIN_POINTS = [
  {
    problem: "興味のある活動がなかった",
    solution: "性格診断であなたの「得意」に合う活動を提案",
    problemIcon: Search,
    solutionIcon: CheckCircle,
  },
  {
    problem: "参加方法などの情報が得られなかった",
    solution: "あなたに合う順に、応募方法までまとめて表示",
    problemIcon: Info,
    solutionIcon: CheckCircle,
  },
  {
    problem: "参加のしづらさ・抵抗感があった",
    solution: "少人数・気楽な活動を優先。メッセージで事前に相談",
    problemIcon: Users,
    solutionIcon: CheckCircle,
  },
  {
    problem: "一緒に参加できる仲間がいなかった",
    solution: "同じタイプの仲間や団体とつながるきっかけに",
    problemIcon: Users,
    solutionIcon: CheckCircle,
  },
  {
    problem: "活動場所が自分のニーズに合わない",
    solution: "地域マップから、近くの小規模活動を見つけられる",
    problemIcon: MapPin,
    solutionIcon: CheckCircle,
  },
];

export function PainPointsSection() {
  return (
    <section id="kadai" className="relative z-10 mt-20 sm:mt-28">
      <LPSectionHeading
        eyebrow="なぜ、はじめられない？"
        title="「やってみたい」のに、一歩を踏み出せない。"
        description="ボランティアに関心はあっても、参加に至らない人は多数。その「つまずき」を、Voluntyはひとつずつ解消します。"
      />

      <div className="space-y-4">
        {PAIN_POINTS.map((item, i) => (
          <div
            key={i}
            className="flex flex-col items-stretch gap-3 rounded-3xl border border-card-border bg-white p-5 shadow-sm sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 items-center gap-3 rounded-xl bg-red-50 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-500">
                <item.problemIcon className="size-4" />
              </span>
              <p className="text-sm font-medium text-text-dark">{item.problem}</p>
            </div>

            <ArrowRight className="mx-auto size-5 shrink-0 text-primary sm:mx-0" />

            <div className="flex flex-1 items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <item.solutionIcon className="size-4" />
              </span>
              <p className="text-sm font-medium text-text-dark">{item.solution}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-text-body opacity-60">
        出典：東京都生活文化スポーツ局「R6 都民のボランティア活動等に関する実態調査」より
      </p>
    </section>
  );
}

import Image from "next/image";
import { ArrowDown, Check, CircleHelp } from "lucide-react";
import { lpAssets } from "./lpAssets";
import { LPSectionHeading } from "./LPSectionHeading";

const PAIN_POINTS = [
  {
    problem: "興味のある活動が見つからない",
    solution: "性格傾向と興味から活動を提案",
  },
  {
    problem: "参加方法がよくわからない",
    solution: "応募までの流れをまとめて表示",
  },
  {
    problem: "ひとりで参加するのが不安",
    solution: "事前メッセージで団体に相談",
  },
] as const;

export function PainPointsSection() {
  return (
    <section id="kadai" className="relative py-20 sm:py-28">
      <LPSectionHeading
        eyebrow="はじめの一歩を、もっと軽やかに"
        title="「やってみたい」のに、一歩を踏み出せない。"
        description="ボランティアに関心はあっても、参加までには小さな不安がいくつも。その「つまずき」を、ボランティーはひとつずつ解消します。"
      />

      <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="relative overflow-hidden rounded-[40px_40px_40px_12px] bg-primary/5">
          <Image
            src={lpAssets.painWelcome.src}
            alt={lpAssets.painWelcome.alt}
            width={lpAssets.painWelcome.width}
            height={lpAssets.painWelcome.height}
            sizes="(max-width: 1024px) 100vw, 42vw"
            className="aspect-[4/3] h-full w-full object-cover"
          />
        </div>

        <div className="space-y-5">
          {PAIN_POINTS.map((item) => (
            <article
              key={item.problem}
              data-testid="pain-solution"
              className="rounded-[28px] border border-card-border bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-center gap-3 rounded-2xl bg-pop-coral-soft px-4 py-3 text-sm font-medium text-text-body">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-primary">
                  <CircleHelp className="size-4" aria-hidden />
                </span>
                <p>{item.problem}</p>
              </div>
              <ArrowDown className="my-2 ml-3 size-4 text-pop-teal" aria-hidden />
              <div className="flex items-center gap-3 rounded-2xl bg-pop-teal-soft px-4 py-3 text-sm font-bold text-text-dark">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pop-teal text-white">
                  <Check className="size-4" aria-hidden />
                </span>
                <p>{item.solution}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <p className="mt-6 text-xs leading-5 text-text-body/70">
        出典：東京都生活文化スポーツ局「都民のボランティア活動等に関する実態調査」を参考に構成
      </p>
    </section>
  );
}

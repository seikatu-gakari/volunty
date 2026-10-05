import Link from "next/link";
import { ArrowUpRight, Users, Lightbulb } from "lucide-react";
import { ACTIVITY_STYLE_DIRECTIONS } from "@/lib/diagnosis-scale/activity-styles";
import { BIG5_DOMAIN_LABELS } from "@/lib/diagnosis-scale/types";

interface FeaturedDirection {
  id: string;
  icon: typeof Users;
  accent: string;
}

/** 2つの特性の両方向を対にして紹介する。 */
const FEATURED_DIRECTIONS = [
  {
    id: "e-high",
    icon: Users,
    accent: "bg-pop-coral-soft text-text-dark border-primary/20",
  },
  {
    id: "e-low",
    icon: Users,
    accent: "bg-pop-coral-soft text-text-dark border-primary/20",
  },
  {
    id: "i-high",
    icon: Lightbulb,
    accent: "bg-pop-purple-soft text-text-dark border-pop-purple/20",
  },
  {
    id: "i-low",
    icon: Lightbulb,
    accent: "bg-pop-purple-soft text-text-dark border-pop-purple/20",
  },
] as const satisfies readonly FeaturedDirection[];

function getActivityStyleDirection(id: string) {
  const direction = ACTIVITY_STYLE_DIRECTIONS.find((direction) => direction.id === id);
  if (!direction) {
    throw new Error(`活動スタイルの方向が見つかりません: ${id}`);
  }
  return direction;
}

export function DiagnosisTypesCarousel() {
  return (
    <section id="styles" className="relative -mx-4 bg-pop-yellow-soft/60 px-4 py-20 sm:-mx-6 sm:px-6 sm:py-28 lg:mx-0 lg:rounded-[40px] lg:px-10">
      <div className="mb-8 max-w-2xl">
        <p className="mb-3 inline-flex rounded-full bg-primary/10 px-4 py-2 text-xs font-bold tracking-[0.16em] text-text-dark">
          5つの特性・10の方向
        </p>
        <h2 className="text-3xl font-black tracking-tight text-text-dark sm:text-4xl">
          あなたらしい一歩のヒント。
        </h2>
        <p className="mt-4 text-sm leading-7 text-text-body sm:text-base">
          性格傾向チェックの回答を理解するための補助ラベルです。
          10の方向のうち、2つの特性の両方向を紹介します。
        </p>
      </div>

      <div
        aria-label="活動スタイルの方向の例"
        className="lp-carousel -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4"
      >
        {FEATURED_DIRECTIONS.map((featured) => {
          const direction = getActivityStyleDirection(featured.id);
          const Icon = featured.icon;
          return (
            <article
              key={direction.id}
              className="lp-carousel-card w-[78vw] max-w-[300px] shrink-0 snap-center overflow-hidden rounded-[28px] border border-card-border bg-white shadow-sm sm:w-auto sm:max-w-none"
            >
              <div className={`flex aspect-[4/3] flex-col items-center justify-center gap-4 ${featured.accent}`}>
                <Icon className="size-16" aria-hidden />
                <span className="text-sm font-bold">{BIG5_DOMAIN_LABELS[direction.domain]}</span>
              </div>
              <div className="p-5">
                <div className={`mb-4 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-bold ${featured.accent}`}>
                  活動スタイルの補助ラベル
                </div>
                <h3 className="min-h-12 text-base font-bold leading-6 text-text-dark">
                  {direction.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-body">{direction.description}</p>
                <Link
                  href="#waitlist"
                  className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-primary-dark"
                >
                  無料で事前登録
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-5 text-xs leading-5 text-text-body">
        ※ 科学的に確立された10類型ではありません。中央付近（中立）や複数の方向（混合）になる場合もあります。
        能力や適性を保証したり、応募できる活動を限定したりするものではありません。
      </p>
    </section>
  );
}

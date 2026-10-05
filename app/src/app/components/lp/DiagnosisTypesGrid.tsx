import { Users, Heart, ListChecks, Waves, Lightbulb } from "lucide-react";
import { ACTIVITY_STYLE_DIRECTIONS } from "@/lib/diagnosis-scale/activity-styles";
import { BIG5_DOMAIN_LABELS, type Big5Domain } from "@/lib/diagnosis-scale/types";
import { LPSectionHeading } from "./LPSectionHeading";

type DirectionDisplay = {
  icon: typeof Users;
  color: string;
  border: string;
};

/** 両方向を同じアイコン・色で示し、方向間に優劣をつけない。 */
const DOMAIN_DISPLAY = {
  extraversion: {
    icon: Users,
    color: "bg-pop-coral-soft text-primary-dark",
    border: "border-t-primary",
  },
  agreeableness: {
    icon: Heart,
    color: "bg-pop-teal-soft text-secondary-dark",
    border: "border-t-pop-teal",
  },
  conscientiousness: {
    icon: ListChecks,
    color: "bg-pop-yellow-soft text-warning",
    border: "border-t-pop-yellow",
  },
  emotionalStability: {
    icon: Waves,
    color: "bg-pop-teal-soft text-secondary-dark",
    border: "border-t-pop-teal",
  },
  intellect: {
    icon: Lightbulb,
    color: "bg-pop-purple-soft text-pop-purple",
    border: "border-t-pop-purple",
  },
} satisfies Record<Big5Domain, DirectionDisplay>;

export function DiagnosisTypesGrid() {
  return (
    <section id="types" className="py-20 sm:py-28">
      <LPSectionHeading
        eyebrow="5つの特性・10の方向"
        title="回答の傾向を知るヒント"
        description={
          <>
            5つの性格特性の両方向を、活動スタイルの補助ラベルで紹介します。
            科学的に確立された10類型ではなく、活動への適性や応募条件を決めるものでもありません。
            どの活動にも応募できます。
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ACTIVITY_STYLE_DIRECTIONS.map((direction) => {
          const display = DOMAIN_DISPLAY[direction.domain];
          const Icon = display.icon;
          return (
            <div
              key={direction.id}
              className={`flex flex-col rounded-[24px] border border-t-4 border-card-border bg-white p-5 shadow-sm ${display.border}`}
            >
              <span
                className={`mb-4 inline-flex size-12 items-center justify-center rounded-xl ${display.color}`}
              >
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="text-base font-bold text-text-dark">{direction.name}</h3>
              <p className="mt-3 text-xs leading-6 text-text-body">{direction.description}</p>
              <div className="mt-4 rounded-xl bg-background px-3 py-2 text-xs font-medium text-text-body">
                {BIG5_DOMAIN_LABELS[direction.domain]}の方向
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs leading-6 text-text-body">
        ＊ 全50問の性格傾向チェック（約5〜8分）で、5つの性格特性のスコアを表示します。
        回答によっては、中央付近（中立）や複数の方向（混合）で表示されます。
      </p>
    </section>
  );
}

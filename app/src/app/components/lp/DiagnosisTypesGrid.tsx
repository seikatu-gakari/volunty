import {
  Users,
  Star,
  Lightbulb,
  Zap,
  Heart,
  BarChart2,
  MessageCircle,
  Handshake,
  Compass,
  Shield,
} from "lucide-react";
import { ACTIVITY_STYLE_TYPES } from "@/lib/diagnosis-scale/style-types";
import { LPSectionHeading } from "./LPSectionHeading";

type ActivityStyleId = (typeof ACTIVITY_STYLE_TYPES)[number]["id"];
type TypeDisplay = {
  icon: typeof Users;
  color: string;
  border: string;
};

/** 参考タイプIDごとの表示設定（アイコン・カラー） */
const TYPE_DISPLAY = {
  "innovator-leader": {
    icon: Star,
    color: "bg-pop-coral-soft text-primary-dark",
    border: "border-t-primary",
  },
  "supporter-care": {
    icon: Heart,
    color: "bg-pop-teal-soft text-secondary-dark",
    border: "border-t-pop-teal",
  },
  "creative-solo": {
    icon: Lightbulb,
    color: "bg-pop-purple-soft text-pop-purple",
    border: "border-t-pop-purple",
  },
  "perfectionist-analyst": {
    icon: BarChart2,
    color: "bg-pop-yellow-soft text-warning",
    border: "border-t-pop-yellow",
  },
  "charisma-entertainer": {
    icon: MessageCircle,
    color: "bg-pop-coral-soft text-primary-dark",
    border: "border-t-primary",
  },
  "strategist-planner": {
    icon: Zap,
    color: "bg-pop-teal-soft text-secondary-dark",
    border: "border-t-pop-teal",
  },
  "harmony-mediator": {
    icon: Handshake,
    color: "bg-pop-yellow-soft text-warning",
    border: "border-t-pop-yellow",
  },
  "adventure-explorer": {
    icon: Compass,
    color: "bg-pop-purple-soft text-pop-purple",
    border: "border-t-pop-purple",
  },
  "conservative-guardian": {
    icon: Shield,
    color: "bg-pop-teal-soft text-secondary-dark",
    border: "border-t-pop-teal",
  },
  "sensitive-artist": {
    icon: Users,
    color: "bg-pop-coral-soft text-primary-dark",
    border: "border-t-primary",
  },
} satisfies Record<ActivityStyleId, TypeDisplay>;

export function DiagnosisTypesGrid() {
  return (
    <section id="types" className="py-20 sm:py-28">
      <LPSectionHeading
        eyebrow="10の活動スタイル（参考タイプ）"
        title="あなたは、どのスタイルに近い？"
        description={
          <>
            性格傾向チェックの結果を、活動スタイルの参考タイプとして分かりやすく表示します。
            タイプは理解を助けるための参考情報で、どの活動にも応募できます。
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ACTIVITY_STYLE_TYPES.map((type) => {
          const display = TYPE_DISPLAY[type.id];
          const Icon = display.icon;
          return (
            <div
              key={type.id}
              className={`flex flex-col rounded-[24px] border border-t-4 border-card-border bg-white p-5 shadow-sm ${display.border}`}
            >
              <span
                className={`mb-4 inline-flex size-12 items-center justify-center rounded-xl ${display.color}`}
              >
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="text-base font-bold text-text-dark">{type.name}</h3>
              <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-background px-3 py-2">
                <span className="text-xs font-bold text-primary-dark">活動例</span>
                <span className="text-xs font-medium text-text-body">
                  {type.activityExamples[0]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-text-body">
        ＊ 全50問の性格傾向チェック（約5〜8分）で、5つの性格特性のスコアと参考タイプを表示します。
      </p>
    </section>
  );
}

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

/** 参考タイプIDごとの表示設定（アイコン・カラー） */
const TYPE_DISPLAY: Record<string, { icon: typeof Users; color: string }> = {
  "innovator-leader": { icon: Star, color: "bg-red-50 text-red-600" },
  "supporter-care": { icon: Heart, color: "bg-pink-50 text-pink-600" },
  "creative-solo": { icon: Lightbulb, color: "bg-violet-50 text-violet-600" },
  "perfectionist-analyst": { icon: BarChart2, color: "bg-indigo-50 text-indigo-600" },
  "charisma-entertainer": { icon: MessageCircle, color: "bg-amber-50 text-amber-600" },
  "strategist-planner": { icon: Zap, color: "bg-emerald-50 text-emerald-600" },
  "harmony-mediator": { icon: Handshake, color: "bg-sky-50 text-sky-600" },
  "adventure-explorer": { icon: Compass, color: "bg-primary/10 text-primary" },
  "conservative-guardian": { icon: Shield, color: "bg-teal-50 text-teal-600" },
  "sensitive-artist": { icon: Users, color: "bg-rose-50 text-rose-600" },
};

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
          const display = TYPE_DISPLAY[type.id] ?? {
            icon: Users,
            color: "bg-primary/10 text-primary",
          };
          const Icon = display.icon;
          return (
            <div
              key={type.id}
              className="flex flex-col rounded-[24px] border border-card-border bg-white p-5 shadow-sm"
            >
              <span
                className={`mb-4 inline-flex size-12 items-center justify-center rounded-xl ${display.color}`}
              >
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="text-base font-bold text-text-dark">{type.name}</h3>
              <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-stone-50 px-3 py-2">
                <span className="text-xs font-bold text-primary">活動例</span>
                <span className="text-xs font-medium text-text-body">
                  {type.activityExamples[0]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-text-body opacity-70">
        ＊ 全50問の性格傾向チェック（約5〜8分）で、5つの性格特性のスコアと参考タイプを表示します。
      </p>
    </section>
  );
}

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
  "innovator-leader": { icon: Star, color: "bg-linear-to-br from-red-50 to-orange-100 text-red-600" },
  "supporter-care": { icon: Heart, color: "bg-linear-to-br from-pink-50 to-rose-100 text-pink-600" },
  "creative-solo": { icon: Lightbulb, color: "bg-linear-to-br from-purple-50 to-violet-100 text-purple-600" },
  "perfectionist-analyst": { icon: BarChart2, color: "bg-linear-to-br from-indigo-50 to-blue-100 text-indigo-600" },
  "charisma-entertainer": { icon: MessageCircle, color: "bg-linear-to-br from-yellow-50 to-amber-100 text-yellow-600" },
  "strategist-planner": { icon: Zap, color: "bg-linear-to-br from-green-50 to-emerald-100 text-green-600" },
  "harmony-mediator": { icon: Handshake, color: "bg-linear-to-br from-blue-50 to-sky-100 text-blue-600" },
  "adventure-explorer": { icon: Compass, color: "bg-linear-to-br from-orange-50 to-amber-100 text-primary" },
  "conservative-guardian": { icon: Shield, color: "bg-linear-to-br from-teal-50 to-cyan-100 text-teal-600" },
  "sensitive-artist": { icon: Users, color: "bg-linear-to-br from-rose-50 to-pink-100 text-rose-600" },
};

export function DiagnosisTypesGrid() {
  return (
    <section id="types" className="relative z-10 mt-20 sm:mt-28">
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
            color: "bg-linear-to-br from-orange-50 to-amber-100 text-primary",
          };
          const Icon = display.icon;
          return (
            <div
              key={type.id}
              className="flex flex-col rounded-2xl border border-card-border bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
            >
              <span
                className={`mb-4 inline-flex size-12 items-center justify-center rounded-xl ${display.color}`}
              >
                <Icon className="size-6" />
              </span>
              <h3 className="text-base font-bold text-text-dark">{type.name}</h3>
              <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-background px-2 py-1.5">
                <span className="text-xs text-primary">→</span>
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

"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Users, Star, Lightbulb, Zap, Heart, BarChart2, MessageCircle, Handshake } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TYPES: {
  name: string;
  icon: LucideIcon;
  iconBg: string;
  scores: Record<string, number>;
  activity: string;
  match: number;
  gradient: string;
  accent: string;
}[] = [
  { name: "縁の下の力持ちタイプ", icon: Users,         iconBg: "bg-orange-100 text-orange-600", scores: { 外向性: 32, 協調性: 70, 誠実性: 90, 開放性: 52 }, activity: "資料整理・受付サポート",       match: 91, gradient: "from-orange-50 to-amber-50",   accent: "#fb5b01" },
  { name: "リーダータイプ",       icon: Star,          iconBg: "bg-red-100 text-red-600",       scores: { 外向性: 88, 協調性: 66, 誠実性: 74, 開放性: 70 }, activity: "地域イベントの運営スタッフ", match: 93, gradient: "from-red-50 to-orange-50",     accent: "#ef4444" },
  { name: "アイデアマンタイプ",   icon: Lightbulb,     iconBg: "bg-purple-100 text-purple-600", scores: { 外向性: 78, 協調性: 86, 誠実性: 64, 開放性: 92 }, activity: "子ども向け工作ワークショップ", match: 94, gradient: "from-purple-50 to-violet-50", accent: "#8b5cf6" },
  { name: "実行力タイプ",         icon: Zap,           iconBg: "bg-green-100 text-green-600",   scores: { 外向性: 70, 協調性: 58, 誠実性: 82, 開放性: 60 }, activity: "河川敷の清掃・緑化活動",       match: 90, gradient: "from-green-50 to-emerald-50", accent: "#10b981" },
  { name: "サポータータイプ",     icon: Heart,         iconBg: "bg-blue-100 text-blue-600",     scores: { 外向性: 60, 協調性: 92, 誠実性: 76, 開放性: 58 }, activity: "イベント当日のチーム補助",     match: 92, gradient: "from-blue-50 to-sky-50",     accent: "#3b82f6" },
  { name: "アナリストタイプ",     icon: BarChart2,     iconBg: "bg-indigo-100 text-indigo-600", scores: { 外向性: 40, 協調性: 54, 誠実性: 88, 開放性: 80 }, activity: "活動データの集計・分析",       match: 89, gradient: "from-indigo-50 to-blue-50",  accent: "#6366f1" },
  { name: "コミュニケータータイプ", icon: MessageCircle, iconBg: "bg-yellow-100 text-yellow-600", scores: { 外向性: 90, 協調性: 80, 誠実性: 62, 開放性: 74 }, activity: "来場者の案内・多言語サポート", match: 93, gradient: "from-yellow-50 to-orange-50", accent: "#f59e0b" },
  { name: "ケアギバータイプ",     icon: Handshake,     iconBg: "bg-pink-100 text-pink-600",     scores: { 外向性: 56, 協調性: 94, 誠実性: 78, 開放性: 66 }, activity: "高齢者の見守り・声かけ",       match: 95, gradient: "from-pink-50 to-rose-50",   accent: "#ec4899" },
];

export function DiagnosisTypesCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "right" ? 320 : -320, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm font-medium text-text-body">
          <span className="mr-2 text-primary">✦</span>
          診断すると、タイプごとにこんな結果が届きます
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="flex size-9 items-center justify-center rounded-full border border-card-border bg-white shadow-sm transition hover:bg-primary/5"
            aria-label="前へ"
          >
            <ChevronLeft className="size-4 text-text-body" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex size-9 items-center justify-center rounded-full border border-card-border bg-white shadow-sm transition hover:bg-primary/5"
            aria-label="次へ"
          >
            <ChevronRight className="size-4 text-text-body" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="lp-carousel flex gap-4 overflow-x-auto pb-4"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {TYPES.map((type) => (
          <div
            key={type.name}
            className={`lp-carousel-card flex w-72 shrink-0 flex-col rounded-2xl bg-linear-to-br ${type.gradient} p-5 shadow-sm ring-1 ring-black/5`}
            style={{ scrollSnapAlign: "start" }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex size-12 items-center justify-center rounded-xl ${type.iconBg}`}>
                <type.icon className="size-6" />
              </div>
              <div>
                <p className="text-xs text-text-body">あなたの診断結果</p>
                <p className="text-sm font-bold text-text-dark">{type.name}</p>
              </div>
            </div>

            <div className="space-y-2">
              {Object.entries(type.scores).map(([label, val]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-12 text-xs text-text-body">{label}</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                      style={{ width: `${val}%`, background: type.accent }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-bold" style={{ color: type.accent }}>{val}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl bg-white/70 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-body">おすすめ活動</span>
                <span className="font-bold" style={{ color: type.accent }}>相性 {type.match}%</span>
              </div>
              <p className="mt-1 text-sm font-bold text-text-dark">{type.activity}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

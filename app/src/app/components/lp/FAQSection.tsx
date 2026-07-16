"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LPSectionHeading } from "./LPSectionHeading";

const FAQ_ITEMS = [
  {
    q: "診断や登録は無料ですか？",
    a: "はい。性格傾向チェック・会員登録ともに無料でご利用いただけます。費用がかかる活動は事前に明記されます。",
  },
  {
    q: "診断はどのくらい時間がかかりますか？",
    a: "簡易診断（15問・約2分）と全50問（約5〜8分）から選べます。いつでも中断・再開が可能です。",
  },
  {
    q: "ボランティアが初めてでも大丈夫ですか？",
    a: "はい。初めての方でも参加しやすい少人数・短時間の活動を優先してご紹介します。事前にメッセージで団体と相談することもできます。",
  },
  {
    q: "スマートフォンからでも使えますか？",
    a: "はい。スマートフォン・タブレット・PCすべてに対応しています。",
  },
  {
    q: "性格診断の結果はどう使われますか？",
    a: "診断結果はおすすめ案件の並び順の参考の一つとしてのみ使用されます。性格を理由に応募が制限されることはなく、第三者への提供や広告目的での利用も行いません。",
  },
  {
    q: "個人情報の扱いが心配です。",
    a: "個人情報は暗号化して厳重に管理しております。プライバシーポリシーに基づき、安心してご利用いただける環境を整えています。",
  },
];

const QUESTION_COLORS = [
  "bg-pop-coral-soft text-primary-dark",
  "bg-pop-teal-soft text-secondary-dark",
  "bg-pop-purple-soft text-text-dark",
  "bg-pop-yellow-soft text-warning",
] as const;

const CHEVRON_COLORS = [
  "text-primary-dark",
  "text-secondary-dark",
  "text-text-dark",
  "text-warning",
] as const;

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 sm:py-28">
      <LPSectionHeading
        eyebrow="よくある質問"
        title="はじめる前の、ちいさな不安に。"
      />

      <div className="mx-auto max-w-3xl space-y-3">
        {FAQ_ITEMS.map((item, i) => {
          const questionColor = QUESTION_COLORS[i % QUESTION_COLORS.length];
          const chevronColor = CHEVRON_COLORS[i % CHEVRON_COLORS.length];

          return (
            <div key={item.q} className="overflow-hidden rounded-2xl border border-card-border bg-white shadow-sm">
              <button
                type="button"
                aria-label={item.q}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-primary/5 sm:px-6"
                aria-expanded={openIndex === i}
              >
                <span className="flex items-center gap-3 text-sm font-bold text-text-dark">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-base font-black ${questionColor}`}
                  >
                    Q.
                  </span>
                  {item.q}
                </span>
                <ChevronDown
                  className={`size-5 shrink-0 transition-transform duration-200 ${chevronColor} ${openIndex === i ? "rotate-180" : ""}`}
                />
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5 sm:px-6">
                  <p className="border-t border-card-border pt-4 text-sm leading-7 text-text-body">{item.a}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

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

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative z-10 mt-20 sm:mt-28">
      <div className="mb-12 text-center">
        <p className="mb-3 text-sm font-medium text-primary">✦ よくある質問 ✦</p>
        <h2 className="text-3xl font-bold tracking-tight text-text-dark sm:text-[32px]">
          はじめる前の、ちいさな不安に。
        </h2>
      </div>

      <div className="mx-auto max-w-2xl divide-y divide-card-border rounded-2xl border border-card-border bg-white shadow-sm">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-primary/5"
              aria-expanded={openIndex === i}
            >
              <span className="text-sm font-bold text-text-dark">{item.q}</span>
              <ChevronDown
                className={`size-5 shrink-0 text-primary transition-transform duration-200 ${openIndex === i ? "rotate-180" : ""}`}
              />
            </button>
            {openIndex === i && (
              <div className="px-6 pb-5">
                <p className="text-sm leading-7 text-text-body">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LPSectionHeading } from "./LPSectionHeading";

const FAQ_ITEMS = [
  {
    q: "今すぐサービスを使えますか？",
    a: "現在はサービス公開に向けて準備中です。メールアドレスを事前登録いただくと、サービス開始時にお知らせします。",
  },
  {
    q: "事前登録は無料ですか？",
    a: "はい、無料です。メールアドレスだけで開始通知に登録でき、パスワードや決済情報の入力は不要です。",
  },
  {
    q: "いつサービスが始まりますか？",
    a: "現在、公開に向けて準備を進めています。サービス開始時に、ご登録のメールアドレスへお知らせします。",
  },
  {
    q: "スマートフォンからでも事前登録できますか？",
    a: "はい。スマートフォン・タブレット・PCから登録できます。",
  },
  {
    q: "事前登録で会員アカウントが作られますか？",
    a: "いいえ。事前登録は開始通知を受け取るためのものです。会員登録や診断・活動への応募は、公開後にご案内します。",
  },
  {
    q: "登録したメールアドレスは何に使いますか？",
    a: "ボランティのサービス開始をお知らせするために使用します。登録フォームの「メールアドレスの利用目的」もご確認ください。",
  },
];

const QUESTION_COLORS = [
  "bg-pop-coral-soft text-text-dark",
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

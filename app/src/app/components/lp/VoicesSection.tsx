import { Quote } from "lucide-react";
import { LPSectionHeading } from "./LPSectionHeading";

/** 利用イメージを伝えるための例示（実際のユーザーの声ではない） */
const VOICES = [
  {
    role: "20代・はじめての参加",
    tag: "サポーター・ケアタイプ",
    text: "「自分に向いてる活動」から探せたので、初参加でも不安が少なかったです。受付サポートから始めました。",
    gradient: "from-blue-50 to-sky-50",
    accent: "text-blue-600 bg-blue-100",
  },
  {
    role: "30代・月1ペースで活動",
    tag: "カリスマ・エンターテイナータイプ",
    text: "おすすめ理由が書いてあるから、納得して選べる。子ども向けワークショップの手伝いが楽しくて続いています。",
    gradient: "from-purple-50 to-violet-50",
    accent: "text-purple-600 bg-purple-100",
  },
  {
    role: "NPO法人・イベント運営",
    tag: "団体",
    text: "活動の雰囲気に合いそうな方へ、こちらからアプローチできるのが助かります。当日のミスマッチが減りました。",
    gradient: "from-orange-50 to-amber-50",
    accent: "text-primary bg-primary/10",
  },
];

export function VoicesSection() {
  return (
    <section className="relative z-10 mt-20 sm:mt-28">
      <LPSectionHeading
        eyebrow="こんな使われ方"
        title="ひとりひとりの「ちょうどいい」参加へ。"
        description="Voluntyが目指す利用シーンのイメージ例です。"
      />

      <div className="grid gap-6 sm:grid-cols-3">
        {VOICES.map((voice) => (
          <div
            key={voice.role}
            className={`flex flex-col rounded-3xl bg-linear-to-br ${voice.gradient} p-6 shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10`}
          >
            <Quote className="mb-4 size-6 text-primary/40" aria-hidden />
            <p className="flex-1 text-sm leading-7 text-text-dark">{voice.text}</p>
            <div className="mt-5 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-text-body">{voice.role}</p>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${voice.accent}`}
              >
                {voice.tag}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-text-body opacity-70">
        ＊ 上記は利用シーンのイメージ例であり、実際のご利用者の声ではありません。
      </p>
    </section>
  );
}

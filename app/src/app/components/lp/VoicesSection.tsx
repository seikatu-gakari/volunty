import Image from "next/image";
import { Quote } from "lucide-react";
import { lpAssets } from "./lpAssets";
import { LPSectionHeading } from "./LPSectionHeading";

/** 利用イメージを伝えるための例示（実際のユーザーの声ではない） */
const VOICES = [
  {
    role: "20代・はじめての参加",
    tag: "サポーター・ケア傾向",
    text: "「自分に向いている理由」がわかったので、初参加でも不安が少なかったです。受付サポートから始めました。",
    image: lpAssets.voiceFirst,
    accent: "bg-pop-coral-soft text-text-dark",
  },
  {
    role: "30代・月1ペースで活動",
    tag: "クリエイティブ・ソロ傾向",
    text: "活動の雰囲気まで見て選べるのがいい。子ども向けワークショップの手伝いが楽しくて続いています。",
    image: lpAssets.voiceMonthly,
    accent: "bg-pop-yellow-soft text-warning",
  },
  {
    role: "NPO法人・イベント運営",
    tag: "活動団体",
    text: "応募前にメッセージで確認できるので、参加する方も私たちも安心して当日を迎えられます。",
    image: lpAssets.voiceOrganization,
    accent: "bg-pop-purple-soft text-text-dark",
  },
] as const;

export function VoicesSection() {
  return (
    <section id="voices" className="bg-transparent px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
      <LPSectionHeading
        eyebrow="こんな使われ方"
        title="ひとりひとりの「ちょうどいい」参加へ。"
        description="ボランティーが目指す利用シーンのイメージ例です。"
      />

      <div className="grid gap-6 md:grid-cols-3">
        {VOICES.map((voice) => (
          <article key={voice.role} className="flex flex-col rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-card-border">
            <div className="flex items-center gap-4">
              <Image
                src={voice.image.src}
                alt={voice.image.alt}
                width={88}
                height={88}
                className="size-16 rounded-2xl object-cover"
              />
              <div>
                <p className="text-xs font-bold text-text-body">{voice.role}</p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${voice.accent}`}>
                  {voice.tag}
                </span>
              </div>
            </div>
            <Quote className="mt-6 size-6 text-primary/30" aria-hidden />
            <p className="mt-3 flex-1 text-sm leading-7 text-text-dark">{voice.text}</p>
          </article>
        ))}
      </div>

      <p className="mt-6 text-xs leading-5 text-text-body">
        ＊ 上記は利用シーンのイメージ例であり、実際のご利用者の声ではありません。
      </p>
    </section>
  );
}

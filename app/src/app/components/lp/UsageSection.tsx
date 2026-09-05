import Image from "next/image";
import { lpAssets } from "./lpAssets";
import { LPSectionHeading } from "./LPSectionHeading";

const STEPS = [
  {
    label: "STEP 01",
    title: "性格傾向チェック・登録",
    description:
      "世界中で使われている性格研究をもとに、5つの性格特性の傾向を確認。簡易15問（約2分）と全50問（約5〜8分）から選べて、登録は無料です。",
    image: lpAssets.stepDiagnosis,
    accent: "bg-pop-coral-soft text-text-dark border-primary/20",
  },
  {
    label: "STEP 02",
    title: "マッチング",
    description:
      "興味分野・地域・日程を中心に、性格傾向も参考にして活動を提案。おすすめの理由も確認できます。",
    image: lpAssets.stepMatching,
    accent: "bg-pop-teal-soft text-secondary-dark border-pop-teal/20",
  },
  {
    label: "STEP 03",
    title: "参加・つながり",
    description:
      "応募前に団体へ質問できるから、持ち物や当日の流れも安心。参加後の記録も残せます。",
    image: lpAssets.painWelcome,
    accent: "bg-pop-purple-soft text-text-dark border-pop-purple/20",
  },
] as const;

export function UsageSection() {
  return (
    <section id="usage" className="rounded-[40px] bg-pop-teal-soft px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
      <LPSectionHeading
        eyebrow="HOW IT WORKS"
        title="はじめるのは、かんたん3ステップ。"
        description="自分を知ることから、活動への参加まで。迷わず進める体験をひとつにつなぎました。"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {STEPS.map((step) => (
          <article key={step.label} className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-card-border">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={step.image.src}
                alt={step.image.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="object-cover"
              />
              <span
                className={`absolute top-4 left-4 rounded-full border px-3 py-1.5 text-xs font-black tracking-[0.14em] shadow-sm ${step.accent}`}
              >
                {step.label}
              </span>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-black text-text-dark">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-text-body">{step.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

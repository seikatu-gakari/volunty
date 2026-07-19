import Image from "next/image";
import { lpAssets } from "./lpAssets";
import { LPSectionHeading } from "./LPSectionHeading";

const BENEFITS = [
  {
    title: "気楽な雰囲気で交流",
    description: "共通の目的があるから、初対面でも自然に会話が始まります。",
    image: lpAssets.benefitFestival,
    accent: "border-b-primary",
    badge: "bg-pop-coral-soft text-text-dark",
  },
  {
    title: "小さな承認体験",
    description: "誰かの「ありがとう」が、自分らしさを認めるきっかけに。",
    image: lpAssets.benefitThanks,
    accent: "border-b-pop-teal",
    badge: "bg-pop-teal-soft text-secondary-dark",
  },
  {
    title: "目に見える成果",
    description: "参加の記録や新しいつながりが、少しずつ積み上がります。",
    image: lpAssets.benefitRecord,
    accent: "border-b-pop-yellow",
    badge: "bg-pop-yellow-soft text-warning",
  },
] as const;

export function BenefitsSection() {
  return (
    <section
      id="benefits"
      className="-mx-4 bg-pop-purple-soft/70 px-4 py-20 sm:-mx-6 sm:px-6 sm:py-28 lg:mx-0 lg:rounded-[40px] lg:px-10"
    >
      <LPSectionHeading
        eyebrow="参加して、変わっていく"
        title="義務じゃない。楽しいから続く。"
        description="交流、小さな承認、目に見える成果。ボランティーのボランティアは、自分のための時間にもなります。"
      />

      <div className="grid gap-6 md:grid-cols-3">
        {BENEFITS.map((benefit, index) => (
          <article
            key={benefit.title}
            className={`overflow-hidden rounded-[30px] border border-card-border border-b-4 bg-white shadow-sm ${benefit.accent}`}
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={benefit.image.src}
                alt={benefit.image.alt}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 hover:scale-[1.03]"
              />
              <span
                className={`absolute top-4 left-4 flex size-9 items-center justify-center rounded-full text-sm font-black shadow-sm ${benefit.badge}`}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-black text-text-dark">{benefit.title}</h3>
              <p className="mt-3 text-sm leading-7 text-text-body">{benefit.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

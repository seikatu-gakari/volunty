import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { findStyleTypeById } from "@/lib/diagnosis-scale/style-types";
import type { ActivityStyleId } from "@/lib/diagnosis-scale/types";
import { lpAssets } from "./lpAssets";

interface FeaturedStyle {
  id: ActivityStyleId;
  description: string;
  image: (typeof lpAssets)[keyof typeof lpAssets];
  accent: string;
}

const FEATURED_STYLES = [
  {
    id: "supporter-care",
    description: "そっと寄り添い、誰かの安心を支える。",
    image: lpAssets.styleSupporter,
    accent: "bg-pop-coral-soft text-text-dark border-primary/20",
  },
  {
    id: "adventure-explorer",
    description: "新しい場所へ飛び込み、体験を楽しむ。",
    image: lpAssets.styleExplorer,
    accent: "bg-pop-teal-soft text-secondary-dark border-pop-teal/20",
  },
  {
    id: "harmony-mediator",
    description: "対話をつなぎ、チームの空気を整える。",
    image: lpAssets.styleMediator,
    accent: "bg-pop-yellow-soft text-warning border-pop-yellow/30",
  },
  {
    id: "creative-solo",
    description: "得意な表現で、静かに力を発揮する。",
    image: lpAssets.styleCreative,
    accent: "bg-pop-purple-soft text-text-dark border-pop-purple/20",
  },
] as const satisfies readonly FeaturedStyle[];

function getActivityStyleName(id: ActivityStyleId) {
  const style = findStyleTypeById(id);
  if (!style) {
    throw new Error(`活動スタイルが見つかりません: ${id}`);
  }
  return style.name.replace(/タイプ$/, "傾向");
}

export function DiagnosisTypesCarousel() {
  return (
    <section id="styles" className="relative -mx-4 bg-transparent px-4 py-20 sm:-mx-6 sm:px-6 sm:py-28 lg:mx-0 lg:rounded-[40px] lg:px-10">
      <div className="mb-8 max-w-2xl">
        <p className="mb-3 inline-flex rounded-full bg-primary/10 px-4 py-2 text-xs font-bold tracking-[0.16em] text-text-dark">
          10の活動スタイル
        </p>
        <h2 className="text-3xl font-black tracking-tight text-text-dark sm:text-4xl">
          あなたらしい一歩のヒント。
        </h2>
        <p className="mt-4 text-sm leading-7 text-text-body sm:text-base">
          性格傾向から、心地よく力を発揮しやすい活動スタイルを見つけます。
        </p>
      </div>

      <div
        aria-label="代表的な活動スタイル"
        className="lp-carousel -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4"
      >
        {FEATURED_STYLES.map((style) => (
          <article
            key={style.id}
            className="lp-carousel-card w-[78vw] max-w-[300px] shrink-0 snap-center overflow-hidden rounded-[28px] border border-card-border bg-white shadow-sm sm:w-auto sm:max-w-none"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={style.image.src}
                alt={style.image.alt}
                fill
                sizes="(max-width: 640px) 78vw, (max-width: 1024px) 45vw, 25vw"
                className="object-cover transition-transform duration-500 hover:scale-[1.03]"
              />
            </div>
            <div className="p-5">
              <div className={`mb-4 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-bold ${style.accent}`}>
                活動スタイル
              </div>
              <h3 className="min-h-12 text-base font-bold leading-6 text-text-dark">
                {getActivityStyleName(style.id)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-text-body">{style.description}</p>
              <Link
                href="/diagnosis/trial"
                className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-primary-dark"
              >
                診断で詳しく見る
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-text-body">
        ※ 表示されるスタイルは性格傾向をもとにした参考情報です。診断結果で可能性を限定するものではありません。
      </p>
    </section>
  );
}

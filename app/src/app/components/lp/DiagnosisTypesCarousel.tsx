import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { lpAssets } from "./lpAssets";

const FEATURED_STYLES = [
  {
    name: "サポーター・ケア傾向",
    description: "そっと寄り添い、誰かの安心を支える。",
    image: lpAssets.styleSupporter,
    accent: "bg-primary/10 text-primary",
  },
  {
    name: "アドベンチャー・エクスプローラー傾向",
    description: "新しい場所へ飛び込み、体験を楽しむ。",
    image: lpAssets.styleExplorer,
    accent: "bg-sky-50 text-sky-700",
  },
  {
    name: "ハーモニー・メディエーター傾向",
    description: "対話をつなぎ、チームの空気を整える。",
    image: lpAssets.styleMediator,
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    name: "クリエイティブ・ソロ傾向",
    description: "得意な表現で、静かに力を発揮する。",
    image: lpAssets.styleCreative,
    accent: "bg-violet-50 text-violet-700",
  },
] as const;

export function DiagnosisTypesCarousel() {
  return (
    <section id="styles" className="relative py-20 sm:py-28">
      <div className="mb-8 max-w-2xl">
        <p className="mb-3 inline-flex rounded-full bg-primary/10 px-4 py-2 text-xs font-bold tracking-[0.16em] text-primary">
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
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4"
      >
        {FEATURED_STYLES.map((style) => (
          <article
            key={style.name}
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
              <div className={`mb-4 inline-flex rounded-full px-3 py-1.5 text-[11px] font-bold ${style.accent}`}>
                活動スタイル
              </div>
              <h3 className="min-h-12 text-base font-bold leading-6 text-text-dark">{style.name}</h3>
              <p className="mt-2 text-sm leading-6 text-text-body">{style.description}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-primary">
                診断で詳しく見る
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
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

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { lpAssets } from "./lpAssets";

export function LPBottomCTA() {
  return (
    <section id="start" className="relative overflow-hidden rounded-[40px] bg-primary px-6 py-16 text-center text-white shadow-xl sm:px-12 sm:py-20">
      <Image
        src={lpAssets.orbitMotif.src}
        alt={lpAssets.orbitMotif.alt}
        width={lpAssets.orbitMotif.width}
        height={lpAssets.orbitMotif.height}
        className="pointer-events-none absolute -top-12 -right-16 w-52 opacity-45 sm:w-72"
      />

      <div className="relative mx-auto max-w-3xl">
        <p className="text-xs font-bold tracking-[0.2em] text-white/75">START YOUR ACTION</p>
        <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          あなたらしい活動を、<br />ボランティーで見つけよう。
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
          まずは約2分の簡易診断から。興味や性格傾向をヒントに、無理なく始められる活動をご案内します。
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/diagnosis/trial"
            className="inline-flex h-14 w-full max-w-[320px] items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-black text-primary shadow-md transition-transform hover:-translate-y-0.5 sm:w-auto"
          >
            無料で簡易診断を試す
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/opportunities"
            className="inline-flex h-14 w-full max-w-[320px] items-center justify-center gap-2 rounded-full border border-white/80 px-7 text-sm font-black text-white transition-colors hover:bg-white/10 sm:w-auto"
          >
            <Search className="size-4" aria-hidden />
            募集中の活動を見る
          </Link>
        </div>
      </div>
    </section>
  );
}

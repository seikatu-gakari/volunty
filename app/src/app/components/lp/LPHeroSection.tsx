import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CheckCircle,
  Clock,
  Smartphone,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { lpAppPreviewImage } from "./lpPreviewImage";

const TRUST_ITEMS = [
  { icon: CheckCircle, text: "登録・診断は無料" },
  { icon: Clock, text: "約2分でできる" },
  { icon: Smartphone, text: "スマホ・PC対応" },
] as const;

const MATCH_POINTS = [
  "BIG5の強みを可視化",
  "あなたに合う順に活動を提案",
  "参加前の不安を減らす導線",
] as const;

export function LPHeroSection() {
  return (
    <section className="relative z-10 overflow-hidden py-10 sm:py-12 lg:py-14 animate-[fade-in-up_0.8s_ease-out_forwards]">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] lg:items-center lg:gap-x-10 lg:gap-y-0">
        <div className="relative z-10 max-w-2xl lg:col-start-1 lg:row-start-1">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-primary-dark shadow-sm ring-1 ring-card-border">
            <Brain className="size-4" />
            性格傾向 × ボランティアマッチング
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            <span className="inline-flex animate-[float_6s_ease-in-out_infinite] items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-primary-dark ring-1 ring-card-border">
              <Brain className="size-4" /> 性格傾向チェック
            </span>
            <span className="inline-flex animate-[float_6s_ease-in-out_1s_infinite] items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-primary-dark ring-1 ring-card-border">
              <Target className="size-4" /> おすすめ理由の見える化
            </span>
            <span className="inline-flex animate-[float_6s_ease-in-out_2s_infinite] items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-primary-dark ring-1 ring-card-border">
              <Sparkles className="size-4" /> 興味×傾向マッチング
            </span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-text-dark sm:text-5xl lg:text-6xl">
            <span className="block">つながる、</span>
            <span className="block">みつかる、</span>
            <span className="block bg-linear-to-r from-primary to-primary-dark bg-clip-text text-transparent">
              変わっていく。
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-text-body">
            「何から始めればいい？」に寄り添うボランティアマッチング。約5〜8分の性格傾向チェックと興味分野で、あなたに合う活動を探しやすくします。
          </p>
        </div>

        <div className="relative lg:col-start-2 lg:row-span-4 lg:row-start-1">
          <div className="absolute inset-x-10 -bottom-5 h-16 rounded-full bg-primary/20 blur-3xl" aria-hidden />
          <div className="relative overflow-hidden rounded-[2rem] bg-white p-2 shadow-2xl ring-1 ring-card-border lp-hero-image">
            <Image
              alt={lpAppPreviewImage.alt}
              className="h-auto w-full rounded-[1.5rem]"
              height={lpAppPreviewImage.height}
              priority
              sizes="(min-width: 1024px) 54vw, 100vw"
              src={lpAppPreviewImage.src}
              width={lpAppPreviewImage.width}
            />
          </div>
        </div>

        <div className="relative z-10 grid gap-3 sm:max-w-xl sm:grid-cols-3 lg:col-start-1 lg:row-start-2">
          {MATCH_POINTS.map((text) => (
            <div
              key={text}
              className="rounded-2xl bg-white/80 px-4 py-3 text-sm font-bold leading-6 text-text-dark shadow-sm ring-1 ring-card-border"
            >
              <CheckCircle className="mb-2 size-4 text-primary" />
              {text}
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-4 flex flex-col gap-4 sm:flex-row sm:gap-5 lg:col-start-1 lg:row-start-3">
          <Link
            href="/diagnosis"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 text-base font-bold text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg sm:w-auto"
          >
            <Zap className="size-5" />
            <span className="whitespace-nowrap">性格傾向チェックを始める</span>
            <span className="ml-1 hidden text-xs font-normal opacity-75 2xl:inline">全50問・約5〜8分・無料</span>
            <ArrowRight className="ml-1 size-5" />
          </Link>
          <Link
            href="/opportunities"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-white/75 px-8 text-base font-bold text-text-dark transition-all hover:bg-white sm:w-auto"
          >
            <span className="whitespace-nowrap">募集中の活動を見る</span>
          </Link>
        </div>

        <div className="relative z-10 mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-body lg:col-start-1 lg:row-start-4">
          {TRUST_ITEMS.map((item) => (
            <span key={item.text} className="inline-flex items-center gap-1.5">
              <item.icon className="size-4 text-primary" />
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

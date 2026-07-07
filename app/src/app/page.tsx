import { Header } from "./components/Header";
import { AuthenticatedHome } from "./components/AuthenticatedHome";
import { Reveal } from "./components/lp/Reveal";
import { LPHeroSection } from "./components/lp/LPHeroSection";
import { DiagnosisTypesCarousel } from "./components/lp/DiagnosisTypesCarousel";
import { DiagnosisTypesGrid } from "./components/lp/DiagnosisTypesGrid";
import { PainPointsSection } from "./components/lp/PainPointsSection";
import { UsageSection } from "./components/lp/UsageSection";
import { BenefitsSection } from "./components/lp/BenefitsSection";
import { VoicesSection } from "./components/lp/VoicesSection";
import { FeaturesSection } from "./components/lp/FeaturesSection";
import { FAQSection } from "./components/lp/FAQSection";
import { LPBottomCTA } from "./components/lp/LPBottomCTA";
import { LPFooter } from "./components/lp/LPFooter";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  let user = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase未設定・接続エラー時はログインなしで表示
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      {user && <AuthenticatedHome user={user} />}

      {!user && (
        <main className="relative mx-auto w-full max-w-7xl overflow-x-hidden px-4 pt-8 pb-20 sm:px-6 lg:px-8">
          {/* 背景 blob 装飾 */}
          <div className="lp-blob top-[120px] -left-32 size-[480px] bg-primary/20" aria-hidden />
          <div className="lp-blob top-[640px] -right-32 size-[560px] bg-primary-light/30" aria-hidden />
          <div className="lp-blob top-[1400px] left-1/3 size-[520px] bg-secondary/10" aria-hidden />
          <div className="lp-blob top-[2200px] -left-24 size-[560px] bg-primary/10" aria-hidden />

          {/* ヒーロー */}
          <LPHeroSection />

          {/* 診断タイプカルーセル */}
          <Reveal>
            <div className="relative z-10 mt-20 sm:mt-28">
              <DiagnosisTypesCarousel />
            </div>
          </Reveal>

          {/* 課題セクション */}
          <Reveal>
            <PainPointsSection />
          </Reveal>

          {/* 使い方（仕組みと統合） */}
          <Reveal>
            <UsageSection />
          </Reveal>

          {/* 10タイプグリッド */}
          <Reveal>
            <DiagnosisTypesGrid />
          </Reveal>

          {/* 参加メリット */}
          <Reveal>
            <BenefitsSection />
          </Reveal>

          {/* 利用イメージ（声） */}
          <Reveal>
            <VoicesSection />
          </Reveal>

          {/* 主な機能 */}
          <Reveal>
            <FeaturesSection />
          </Reveal>

          {/* FAQ */}
          <Reveal>
            <FAQSection />
          </Reveal>

          {/* ボトム CTA */}
          <Reveal>
            <LPBottomCTA />
          </Reveal>

          {/* フッター */}
          <LPFooter />
        </main>
      )}
    </div>
  );
}

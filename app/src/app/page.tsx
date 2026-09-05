import { Header } from "./components/Header";
import {
  AuthenticatedHome,
} from "./components/AuthenticatedHome";
import { Reveal } from "./components/lp/Reveal";
import { LPHeroSection } from "./components/lp/LPHeroSection";
import { DiagnosisTypesCarousel } from "./components/lp/DiagnosisTypesCarousel";
import { DiagnosisTypesGrid } from "./components/lp/DiagnosisTypesGrid";
import { PainPointsSection } from "./components/lp/PainPointsSection";
import { UsageSection } from "./components/lp/UsageSection";
import { BenefitsSection } from "./components/lp/BenefitsSection";
import { FeaturesSection } from "./components/lp/FeaturesSection";
import { FAQSection } from "./components/lp/FAQSection";
import { LPBottomCTA } from "./components/lp/LPBottomCTA";
import { LPFooter } from "./components/lp/LPFooter";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/viewer-context";

export default async function Home() {
  const viewer = await getViewerContext();
  if (viewer.status === "error") {
    throw new Error("認証状態の確認に失敗しました");
  }

  const shouldRedirectToRoleSelection =
    viewer.status === "authenticated" &&
    ((viewer.role === "participant" && !viewer.hasParticipantProfile) ||
      (viewer.role === "organization" && !viewer.hasOrganizationProfile));

  if (shouldRedirectToRoleSelection) {
    redirect("/onboarding/role");
  }

  const authenticatedViewer =
    viewer.status === "authenticated" && viewer.isActive ? viewer : null;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header
        variant="landing"
        viewerContext={viewer}
      />

      {authenticatedViewer && (
        <AuthenticatedHome
          identity={authenticatedViewer.identity}
          role={authenticatedViewer.role}
          organizationVerified={
            authenticatedViewer.organizationVerified ||
            authenticatedViewer.organizationReviewStatus === "approved"
          }
        />
      )}

      {!authenticatedViewer && (
        <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 pb-20 sm:px-6 lg:px-8">
          <LPHeroSection />

          {/* 診断タイプカルーセル */}
          <Reveal>
            <DiagnosisTypesCarousel />
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

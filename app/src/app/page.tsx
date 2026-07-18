import { Header } from "./components/Header";
import {
  AuthenticatedHome,
  type AuthenticatedHomeRole,
} from "./components/AuthenticatedHome";
import { LPPaperStage } from "./components/lp/LPPaperStage";
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

function isAuthenticatedHomeRole(value: unknown): value is Exclude<AuthenticatedHomeRole, null> {
  return value === "participant" || value === "organization" || value === "admin";
}

function isOrganizationApproved(profile: {
  verified?: boolean | null;
  review_status?: string | null;
} | null): boolean {
  return !!profile?.verified || profile?.review_status === "approved";
}

export default async function Home() {
  let user = null;
  let role: AuthenticatedHomeRole = null;
  let onboardingCompleted = false;
  let organizationVerified = false;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const metadata = user.user_metadata as Record<string, unknown>;
      onboardingCompleted = !!metadata.onboarding_completed;

      const { data: account } = await supabase
        .from("m_user")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (isAuthenticatedHomeRole(account?.role)) {
        role = account.role;
      } else if (isAuthenticatedHomeRole(metadata.role)) {
        role = metadata.role;
      }

      if (role === "organization") {
        const { data: organizationProfile } = await supabase
          .from("m_organization_profile")
          .select("verified, review_status")
          .eq("user_id", user.id)
          .maybeSingle();
        organizationVerified = isOrganizationApproved(organizationProfile);
      }
    }
  } catch {
    // Supabase未設定・接続エラー時はログインなしで表示
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header variant="landing" />

      {user && (
        <AuthenticatedHome
          user={user}
          role={role}
          onboardingCompleted={onboardingCompleted}
          organizationVerified={organizationVerified}
        />
      )}

      {!user && (
        <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 pb-20 sm:px-6 lg:px-8">
          <LPPaperStage variant="hero">
            <LPHeroSection />
            <Reveal>
              <DiagnosisTypesCarousel />
            </Reveal>
          </LPPaperStage>

          <LPPaperStage variant="journey">
            <Reveal>
              <PainPointsSection />
            </Reveal>
            <Reveal>
              <UsageSection />
            </Reveal>
          </LPPaperStage>

          <LPPaperStage variant="styles">
            <Reveal>
              <DiagnosisTypesGrid />
            </Reveal>
            <Reveal>
              <BenefitsSection />
            </Reveal>
          </LPPaperStage>

          <LPPaperStage variant="trust">
            <Reveal>
              <VoicesSection />
            </Reveal>
            <Reveal>
              <FeaturesSection />
            </Reveal>
            <Reveal>
              <FAQSection />
            </Reveal>
          </LPPaperStage>

          <Reveal>
            <LPBottomCTA />
          </Reveal>
          <LPFooter />
        </main>
      )}
    </div>
  );
}

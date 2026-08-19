import { Header } from "./components/Header";
import {
  AuthenticatedHome,
  type AuthenticatedHomeRole,
} from "./components/AuthenticatedHome";
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
import { redirect } from "next/navigation";
import { needsRoleSelection, parseOnboardingRole } from "@/lib/onboarding/role";
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
  let organizationVerified = false;
  let shouldRedirectToRoleSelection = false;
  let onboardingCompletedForHeader = false;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const { data: account, error: accountError } = await supabase
        .from("m_user")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const databaseRole = accountError
        ? null
        : parseOnboardingRole(account?.role);
      if (accountError) {
        console.error("[Home] m_user照会に失敗:", accountError);
      } else if (databaseRole && isAuthenticatedHomeRole(databaseRole)) {
        role = databaseRole;
      }

      if (databaseRole === "participant") {
        const { data: participantProfile, error: profileError } = await supabase
          .from("m_participant_profile")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("[Home] 参加者プロフィール照会に失敗:", profileError);
        } else {
          onboardingCompletedForHeader = !!participantProfile;
          shouldRedirectToRoleSelection = needsRoleSelection({
            role: databaseRole,
            hasParticipantProfile: !!participantProfile,
            hasOrganizationProfile: false,
          });
        }
      } else if (databaseRole === "organization") {
        const { data: organizationProfile, error: profileError } = await supabase
          .from("m_organization_profile")
          .select("id, verified, review_status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileError) {
          console.error("[Home] 団体プロフィール照会に失敗:", profileError);
        } else {
          onboardingCompletedForHeader = !!organizationProfile;
          organizationVerified = isOrganizationApproved(organizationProfile);
          shouldRedirectToRoleSelection = needsRoleSelection({
            role: databaseRole,
            hasParticipantProfile: false,
            hasOrganizationProfile: !!organizationProfile,
          });
        }
      }
    }
  } catch {
    // Supabase未設定・接続エラー時はログインなしで表示
  }

  if (shouldRedirectToRoleSelection) {
    redirect("/onboarding/role");
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header
        variant="landing"
        onboardingCompleted={onboardingCompletedForHeader}
      />

      {user && (
        <AuthenticatedHome
          user={user}
          role={role}
          organizationVerified={organizationVerified}
        />
      )}

      {!user && (
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

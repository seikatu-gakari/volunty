import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { OrganizationProfileForm } from "./components/OrganizationProfileForm";

/** 認証状態・ロール・プロフィール登録状況を取得する */
async function getPageState(): Promise<{
  isAuthenticated: boolean;
  isOrganization: boolean;
  hasProfile: boolean;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { isAuthenticated: false, isOrganization: false, hasProfile: false };
    }

    const role = user.user_metadata?.role as string | undefined;
    const isOrganization = role === "organization";

    // プロフィール登録済みか確認
    const profile = await prisma.organizationProfile.findUnique({
      where: { userId: user.id },
      select: { userId: true },
    });

    return { isAuthenticated: true, isOrganization, hasProfile: !!profile };
  } catch {
    // Supabase 未設定時はスキップ
    return { isAuthenticated: false, isOrganization: false, hasProfile: false };
  }
}

export default async function OnboardingOrganizationPage() {
  const { isAuthenticated, isOrganization, hasProfile } = await getPageState();

  if (!isAuthenticated) redirect("/login");
  if (!isOrganization) redirect("/onboarding/role");
  if (hasProfile) redirect("/onboarding/pending");

  return <OrganizationProfileForm />;
}

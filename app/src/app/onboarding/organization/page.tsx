import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { OrganizationProfileForm } from "./components/OrganizationProfileForm";

/** 認証状態・ロール・プロフィール登録状況を取得する */
async function getPageState(): Promise<{
  isAuthenticated: boolean;
  isOrganization: boolean;
  hasProfile: boolean;
  canEditExistingProfile: boolean;
  defaultValues: {
    organizationName: string;
    representativeName: string;
    contactEmail: string;
    activityAreas: string[];
    description: string;
    activityCategories: string[];
    websiteUrl: string;
    logoUrl: string;
    contactLineId: string;
    contactLineUrl: string;
  } | null;
}> {
  // 1. 認証チェック
  let user;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return {
      isAuthenticated: false,
      isOrganization: false,
      hasProfile: false,
      canEditExistingProfile: false,
      defaultValues: null,
    };
  }

  if (!user) {
    return {
      isAuthenticated: false,
      isOrganization: false,
      hasProfile: false,
      canEditExistingProfile: false,
      defaultValues: null,
    };
  }

  const role = user.user_metadata?.role as string | undefined;
  const isOrganization = role === "organization";

  // 2. プロフィールチェック（DB エラー時は未登録扱いだが認証は true を維持）
  try {
    // プロフィール登録済みか確認
    const profile = await prisma.organizationProfile.findUnique({
      where: { userId: user.id },
      select: {
        userId: true,
        organizationName: true,
        representativeName: true,
        contactEmail: true,
        activityAreas: true,
        description: true,
        activityCategories: true,
        websiteUrl: true,
        logoUrl: true,
        contactLineId: true,
        contactLineUrl: true,
        reviewStatus: true,
      },
    });

    if (!profile) {
      return {
        isAuthenticated: true,
        isOrganization,
        hasProfile: false,
        canEditExistingProfile: false,
        defaultValues: null,
      };
    }

    return {
      isAuthenticated: true,
      isOrganization,
      hasProfile: true,
      canEditExistingProfile: profile.reviewStatus === "rejected",
      defaultValues: {
        organizationName: profile.organizationName,
        representativeName: profile.representativeName ?? "",
        contactEmail: profile.contactEmail ?? "",
        activityAreas: Array.isArray(profile.activityAreas)
          ? (profile.activityAreas as string[])
          : [],
        description: profile.description ?? "",
        activityCategories: Array.isArray(profile.activityCategories)
          ? (profile.activityCategories as string[])
          : [],
        websiteUrl: profile.websiteUrl ?? "",
        logoUrl: profile.logoUrl ?? "",
        contactLineId: profile.contactLineId ?? "",
        contactLineUrl: profile.contactLineUrl ?? "",
      },
    };
  } catch {
    // DB エラーでもログイン状態は維持してフォームを表示する
    return {
      isAuthenticated: true,
      isOrganization,
      hasProfile: false,
      canEditExistingProfile: false,
      defaultValues: null,
    };
  }
}

export default async function OnboardingOrganizationPage() {
  const {
    isAuthenticated,
    isOrganization,
    hasProfile,
    canEditExistingProfile,
    defaultValues,
  } = await getPageState();

  if (!isAuthenticated) redirect("/login");
  if (!isOrganization) redirect("/onboarding/role");
  if (hasProfile && !canEditExistingProfile) redirect("/onboarding/pending");

  return (
    <OrganizationProfileForm
      isEdit={canEditExistingProfile}
      editMode="reapply"
      defaultValues={defaultValues}
    />
  );
}

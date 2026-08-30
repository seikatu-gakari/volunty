import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { prisma } from "@/lib/prisma";
import { OrganizationProfileForm } from "./components/OrganizationProfileForm";

export default async function OnboardingOrganizationPage() {
  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive) {
    redirect("/auth/signout?reason=suspended");
  }
  if (viewer.role !== "organization") redirect("/onboarding/role");
  if (!viewer.hasOrganizationProfile) {
    return <OrganizationProfileForm isEdit={false} editMode="reapply" />;
  }
  if (viewer.organizationReviewStatus !== "rejected") {
    redirect("/onboarding/pending");
  }

  const profile = await prisma.organizationProfile.findUnique({
    where: { userId: viewer.identity.id },
    select: {
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
  if (!profile || profile.reviewStatus !== "rejected") {
    throw new Error("団体プロフィールを確認できませんでした");
  }

  const defaultValues = {
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
  };

  return (
    <OrganizationProfileForm
      isEdit={true}
      editMode="reapply"
      defaultValues={defaultValues}
    />
  );
}

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/app/components/Header";
import { OrganizationProfileForm } from "@/app/onboarding/organization/components/OrganizationProfileForm";
import { getViewerContext } from "@/lib/auth/viewer-context";

export default async function OrganizationProfileEditPage() {
  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive || viewer.role !== "organization") {
    redirect("/forbidden");
  }
  if (!viewer.hasOrganizationProfile) {
    redirect("/onboarding/organization");
  }
  if (viewer.organizationReviewStatus !== "approved") {
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
      verified: true,
    },
  });

  if (!profile) {
    redirect("/onboarding/organization");
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
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning">
          承認済みプロフィールを修正すると、確認のため再審査になります。保存後は審査完了まで審査待ち画面へ移動します。
        </div>
        <OrganizationProfileForm
          isEdit={true}
          editMode="approved"
          defaultValues={defaultValues}
        />
      </main>
    </div>
  );
}

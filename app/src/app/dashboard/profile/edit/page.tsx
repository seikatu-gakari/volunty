import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Header } from "@/app/components/Header";
import { OrganizationProfileForm } from "@/app/onboarding/organization/components/OrganizationProfileForm";

export default async function OrganizationProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = user.user_metadata?.role as string | undefined;
  if (role !== "organization") {
    redirect("/forbidden");
  }

  const profile = await prisma.organizationProfile.findUnique({
    where: { userId: user.id },
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
      <Header />
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

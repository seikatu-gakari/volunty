import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { Header } from "@/app/components/Header";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { fetchOpportunityForEditQuery } from "@/lib/dashboard/queries";
import { EditFormWrapper } from "./components/EditFormWrapper";

export default async function EditOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const viewer = await getViewerContext();
  if (viewer.status === "guest") redirect("/login");
  if (viewer.status === "error") {
    throw new Error("閲覧者情報を確認できませんでした");
  }
  if (!viewer.isActive || viewer.role !== "organization") {
    redirect("/forbidden");
  }
  if (!viewer.hasOrganizationProfile) {
    redirect("/onboarding/role");
  }
  if (viewer.organizationReviewStatus !== "approved") {
    redirect("/onboarding/pending");
  }

  // 案件データの取得（自団体の案件のみ）
  const { opportunity } = await fetchOpportunityForEditQuery(viewer.identity.id, id);

  // 案件が存在しない or 他団体の案件の場合は 404
  if (!opportunity) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />

      <main className="mx-auto max-w-3xl px-6 py-8">
        <EditFormWrapper
          opportunityId={opportunity.id}
          initialData={{
            title: opportunity.title,
            description: opportunity.description,
            activity_style_tags: opportunity.activity_style_tags,
            required_qualifications: opportunity.required_qualifications,
            min_age: opportunity.min_age,
            max_age: opportunity.max_age,
            status: opportunity.status,
            location: opportunity.location,
            start_date: opportunity.start_date,
            end_date: opportunity.end_date,
            capacity: opportunity.capacity,
            category: opportunity.category,
            participation_mode: opportunity.participation_mode,
          }}
        />
      </main>
    </div>
  );
}

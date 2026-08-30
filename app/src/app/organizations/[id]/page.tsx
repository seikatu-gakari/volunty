import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Building2, ArrowLeft, ArrowRight } from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { fetchOrganizationDetailQuery } from "@/lib/organizations/queries";

export default async function OrganizationDetailPage({
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
  if (!viewer.isActive || viewer.role !== "participant") {
    redirect("/forbidden");
  }
  if (!viewer.hasParticipantProfile) {
    redirect("/onboarding/role");
  }

  const { organization, opportunities } =
    await fetchOrganizationDetailQuery(viewer.identity.id, id);

  // 団体が存在しない場合は 404
  if (!organization) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* 戻るリンク */}
        <Link
          href="/recommendations"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          おすすめ案件に戻る
        </Link>

        {/* 団体ヘッダー */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="size-7 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-text-dark">
              {organization.name}
            </h1>
          </div>
        </div>

        {/* 活動内容 */}
        {organization.description && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-bold text-text-dark">活動内容</h2>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-text-body">
                {organization.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* 募集案件一覧 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-text-dark">
                公開中の募集案件
              </h2>
              <span className="text-xs text-text-body">
                {opportunities.length}件の案件
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {opportunities.length > 0 ? (
              <div className="flex flex-col gap-4">
                {opportunities.map((opp) => {
                  return (
                    <Link
                      key={opp.id}
                      href={`/opportunities/${opp.id}`}
                      className="group flex flex-col gap-3 rounded-lg border border-card-border bg-background/50 p-4 transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-base font-bold text-text-dark group-hover:text-primary">
                          {opp.title}
                        </h3>
                      </div>

                      {opp.description && (
                        <p className="line-clamp-2 text-sm leading-5 text-text-body">
                          {opp.description}
                        </p>
                      )}

                      <div className="mt-auto flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
                        詳細を見る
                        <ArrowRight className="size-4" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-body">
                現在公開中の募集案件はありません。
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

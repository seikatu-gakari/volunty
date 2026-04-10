import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Building2, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent, CardHeader } from "@/app/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { fetchOrganizationDetail } from "@/lib/organizations/actions";

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 認証チェック
  let isAuthenticated = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    isAuthenticated = !!data.user;
  } catch {
    // Supabase 未設定時
  }

  if (!isAuthenticated) {
    redirect("/login");
  }

  const { organization, opportunities, isParticipant } =
    await fetchOrganizationDetail(id);

  // 団体が存在しない場合は 404
  if (!organization) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

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
                  const scoreColor =
                    opp.matchScore !== null
                      ? opp.matchScore >= 80
                        ? "bg-primary"
                        : opp.matchScore >= 60
                          ? "bg-primary-dark"
                          : "bg-text-body"
                      : "";

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
                        {isParticipant && opp.matchScore !== null && (
                          <div className="flex shrink-0 items-center gap-1">
                            <Sparkles className="size-4 text-primary" />
                            <span className="text-lg font-bold text-text-dark">
                              {opp.matchScore}
                              <span className="text-xs font-normal text-text-body">
                                %
                              </span>
                            </span>
                          </div>
                        )}
                      </div>

                      {isParticipant && opp.matchScore !== null && (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${scoreColor} transition-all`}
                            style={{ width: `${opp.matchScore}%` }}
                          />
                        </div>
                      )}

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

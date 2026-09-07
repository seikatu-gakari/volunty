import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent } from "@/app/components/ui/Card";
import { BookmarkButton } from "./[id]/components/BookmarkButton";
import { OpportunityFilters } from "./components/OpportunityFilters";
import {
  fetchPublicOpportunities,
  type PublicOpportunityFilters,
} from "@/lib/opportunities/public-list";
import {
  buildOpportunityDetailHref,
  normalizeOpportunitySearchFilters,
  type OpportunitySearchParams,
} from "@/lib/opportunities/navigation";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { fetchBookmarkedOpportunityIds } from "@/lib/bookmarks/queries";

type OpportunitiesPageProps = {
  searchParams?: Promise<OpportunitySearchParams>;
};

export default async function OpportunitiesPage({
  searchParams,
}: OpportunitiesPageProps) {
  const params = await searchParams;
  const filters: PublicOpportunityFilters =
    normalizeOpportunitySearchFilters(params);
  const filterKey = JSON.stringify([
    filters.q ?? "",
    filters.category ?? "",
    filters.region ?? "",
    filters.participationMode ?? "",
    filters.schedule ?? "",
    filters.beginner === true,
  ]);
  const [opportunities, viewer] = await Promise.all([
    fetchPublicOpportunities(filters),
    getViewerContext(),
  ]);
  const bookmarkedOpportunityIds = new Set(
    viewer.status === "authenticated" &&
    viewer.isActive &&
    viewer.role === "participant" &&
    viewer.hasParticipantProfile
      ? await fetchBookmarkedOpportunityIds(
          viewer.identity.id,
          opportunities.map(({ id }) => id),
        )
      : [],
  );

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header viewerContext={viewer} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-dark">活動を探す</h1>
          <p className="mt-2 text-sm text-text-body">
            キーワードや条件から、参加しやすい募集案件を探せます。
          </p>
        </div>

        <OpportunityFilters key={filterKey} filters={filters} />

        {opportunities.length === 0 ? (
          <Card>
            <CardContent>
              <p className="py-8 text-center text-sm text-text-body">
                条件に一致する募集案件はありません。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {opportunities.map((opportunity) => {
              const detailHref = buildOpportunityDetailHref(
                opportunity.id,
                params
              );
              return (
                <div
                  key={opportunity.id}
                  className="rounded-lg border border-card-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-col gap-3">
                    <div>
                      <Link
                        href={detailHref}
                        className="text-lg font-bold text-text-dark hover:text-primary"
                      >
                        {opportunity.title}
                      </Link>
                      <p className="text-sm text-text-body">
                        {opportunity.organizationName}
                      </p>
                    </div>
                    {opportunity.description && (
                      <p className="line-clamp-2 text-sm leading-6 text-text-body">
                        {opportunity.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {opportunity.badges.map((badge) => (
                        <span
                          key={badge}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                        >
                          <Calendar className="size-3" />
                          {badge}
                        </span>
                      ))}
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                      <Link
                        href={detailHref}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary"
                      >
                        詳細を見る
                        <ArrowRight className="size-4" />
                      </Link>
                      <BookmarkButton
                        opportunityId={opportunity.id}
                        initialBookmarked={bookmarkedOpportunityIds.has(
                          opportunity.id
                        )}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

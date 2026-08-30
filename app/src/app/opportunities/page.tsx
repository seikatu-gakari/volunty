import Link from "next/link";
import { ArrowRight, Calendar, Search, X } from "lucide-react";
import { Header } from "@/app/components/Header";
import { Card, CardContent } from "@/app/components/ui/Card";
import { BookmarkButton } from "./[id]/components/BookmarkButton";
import {
  fetchPublicOpportunities,
  type PublicOpportunityFilters,
} from "@/lib/opportunities/public-list";
import {
  CATEGORY_OPTIONS,
  PARTICIPATION_MODE_OPTIONS,
} from "@/lib/opportunities/constants";
import { fetchBookmarkedOpportunityIds } from "@/lib/bookmarks/actions";
import {
  buildOpportunityDetailHref,
  normalizeOpportunitySearchFilters,
  type OpportunitySearchParams,
} from "@/lib/opportunities/navigation";

type OpportunitiesPageProps = {
  searchParams?: Promise<OpportunitySearchParams>;
};

export default async function OpportunitiesPage({
  searchParams,
}: OpportunitiesPageProps) {
  const params = await searchParams;
  const filters: PublicOpportunityFilters =
    normalizeOpportunitySearchFilters(params);
  const opportunities = await fetchPublicOpportunities(filters);
  const bookmarkedOpportunityIds = new Set(
    await fetchBookmarkedOpportunityIds(opportunities.map(({ id }) => id))
  );

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-dark">活動を探す</h1>
          <p className="mt-2 text-sm text-text-body">
            キーワードや条件から、参加しやすい募集案件を探せます。
          </p>
        </div>

        <form
          className="mb-8 grid gap-4 rounded-lg border border-card-border bg-white p-4 shadow-sm md:grid-cols-3"
          method="get"
        >
          <label className="flex flex-col gap-1 md:col-span-3">
            <span className="text-sm font-medium text-text-dark">キーワード</span>
            <input
              className="h-11 rounded-lg border border-input-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              defaultValue={filters.q ?? ""}
              name="q"
              placeholder="タイトル・活動内容・団体名で検索"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-dark">カテゴリ</span>
            <select
              className="h-11 rounded-lg border border-input-border px-3 text-sm"
              defaultValue={filters.category ?? ""}
              name="category"
            >
              <option value="">すべて</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-dark">地域</span>
            <input
              className="h-11 rounded-lg border border-input-border px-3 text-sm"
              defaultValue={filters.region ?? ""}
              name="region"
              placeholder="例: 渋谷区"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-dark">参加形態</span>
            <select
              className="h-11 rounded-lg border border-input-border px-3 text-sm"
              defaultValue={filters.participationMode ?? ""}
              name="participationMode"
            >
              <option value="">すべて</option>
              {PARTICIPATION_MODE_OPTIONS.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-text-dark">
            <input
              defaultChecked={filters.schedule === "weekend"}
              name="schedule"
              type="checkbox"
              value="weekend"
              className="accent-primary"
            />
            週末に参加できる
          </label>
          <label className="flex items-center gap-2 text-sm text-text-dark">
            <input
              defaultChecked={filters.beginner === true}
              name="beginner"
              type="checkbox"
              value="true"
              className="accent-primary"
            />
            初心者歓迎
          </label>
          <div className="flex gap-2 md:col-span-3">
            <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-dark">
              <Search className="size-4" />
              検索する
            </button>
            <Link
              href="/opportunities"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-card-border px-4 text-sm font-medium text-text-body hover:bg-background"
            >
              <X className="size-4" />
              条件を解除
            </Link>
          </div>
        </form>

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

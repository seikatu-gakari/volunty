import { isValidCategory, isValidParticipationMode } from "./constants";
import type { OpportunityViewSource } from "@/lib/opportunities/queries";
import type { PublicOpportunityFilters } from "./public-list";

export type OpportunitySearchParams = {
  q?: string | string[];
  category?: string | string[];
  region?: string | string[];
  participationMode?: string | string[];
  schedule?: string | string[];
  beginner?: string | string[];
};

function pick(value?: string | string[]): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

export function normalizeOpportunitySearchFilters(
  params?: OpportunitySearchParams
): PublicOpportunityFilters {
  const category = pick(params?.category);
  const participationMode = pick(params?.participationMode);
  const schedule = pick(params?.schedule);
  const beginner = pick(params?.beginner);

  return {
    q: pick(params?.q),
    category: category && isValidCategory(category) ? category : undefined,
    region: pick(params?.region),
    participationMode:
      participationMode && isValidParticipationMode(participationMode)
        ? participationMode
        : undefined,
    schedule: schedule === "weekend" ? schedule : undefined,
    beginner: beginner === "true" ? true : undefined,
  };
}

function serializeSearchFilters(params?: OpportunitySearchParams): string {
  const filters = normalizeOpportunitySearchFilters(params);
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.category) query.set("category", filters.category);
  if (filters.region) query.set("region", filters.region);
  if (filters.participationMode) {
    query.set("participationMode", filters.participationMode);
  }
  if (filters.schedule) query.set("schedule", filters.schedule);
  if (filters.beginner) query.set("beginner", "true");
  return query.toString();
}

export function getOpportunityViewSource(
  from?: string | string[]
): OpportunityViewSource {
  const value = Array.isArray(from) ? from[0] : from;
  if (value === "rec") return "recommendation";
  if (value === "search") return "search";
  return "direct";
}

export function buildOpportunityDetailHref(
  opportunityId: string,
  params?: OpportunitySearchParams
): string {
  const filters = serializeSearchFilters(params);
  return `/opportunities/${encodeURIComponent(opportunityId)}?from=search${
    filters ? `&${filters}` : ""
  }`;
}

/** 公開詳細の応募導線で、ログイン後に同じ詳細URLへ復帰する。 */
export function buildOpportunityLoginHref(
  opportunityId: string,
  params?: OpportunitySearchParams & { from?: string | string[]; rlog?: string | string[] }
): string {
  const query = new URLSearchParams();
  const from = pick(params?.from);
  const rlog = pick(params?.rlog);
  if (from) query.set("from", from);
  if (getOpportunityViewSource(params?.from) === "search") {
    new URLSearchParams(serializeSearchFilters(params)).forEach((value, key) => {
      query.set(key, value);
    });
  }
  if (rlog) query.set("rlog", rlog);
  const detailPath = `/opportunities/${encodeURIComponent(opportunityId)}${
    query.size > 0 ? `?${query.toString()}` : ""
  }`;
  return `/login?next=${encodeURIComponent(detailPath)}`;
}

export function getOpportunityBackLink(
  viewSource: OpportunityViewSource,
  params?: OpportunitySearchParams,
  isGuest = false
): { href: string; label: string } {
  if (viewSource === "search") {
    const filters = serializeSearchFilters(params);
    return {
      href: `/opportunities${filters ? `?${filters}` : ""}`,
      label: "案件検索結果に戻る",
    };
  }

  if (isGuest && viewSource === "direct") {
    return { href: "/opportunities", label: "募集一覧に戻る" };
  }

  return {
    href: "/recommendations",
    label: "おすすめ案件に戻る",
  };
}

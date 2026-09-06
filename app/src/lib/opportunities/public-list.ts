import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { ParticipationMode } from "@/lib/opportunities/constants";

export interface PublicOpportunityFilters {
  q?: string;
  category?: string;
  region?: string;
  participationMode?: "online" | "offline" | "hybrid";
  schedule?: "weekend";
  beginner?: boolean;
}

export interface PublicOpportunity {
  id: string;
  title: string;
  description: string | null;
  organizationName: string;
  location: string | null;
  category: string | null;
  participationMode: ParticipationMode | null;
  startDate: string | null;
  endDate: string | null;
  capacity: number | null;
  currentApplicants: number;
  badges: string[];
}

function normalize(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function includesWeekend(startDate: Date | null, endDate: Date | null): boolean {
  if (!startDate && !endDate) return false;
  const start = startDate ?? endDate;
  const end = endDate ?? startDate;
  if (!start || !end) return false;

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (cursor <= last) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) return true;
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

export function getOpportunityBadges(
  opportunity: {
    capacity: number | null;
    currentApplicants: number;
    startDate: Date | string | null;
  },
  now = new Date()
): string[] {
  const badges: string[] = [];
  if (opportunity.capacity !== null) {
    const remaining = opportunity.capacity - opportunity.currentApplicants;
    badges.push(remaining > 0 ? `残り${remaining}枠` : "満員");
  }

  if (opportunity.startDate) {
    const start = new Date(opportunity.startDate);
    const diffDays = Math.ceil(
      (start.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (diffDays === 0) {
      badges.push("本日開始");
    } else if (diffDays > 0 && diffDays <= 7) {
      badges.push(`開始まであと${diffDays}日`);
    }
  }

  return badges;
}

export async function fetchPublicOpportunities(
  filters: PublicOpportunityFilters = {}
): Promise<PublicOpportunity[]> {
  const query = normalize(filters.q);
  const category = normalize(filters.category);
  const region = normalize(filters.region);
  const now = new Date();

  const and: Prisma.OpportunityWhereInput[] = [];
  const where: Prisma.OpportunityWhereInput = {
    status: "published",
    publishedAt: { not: null, lte: now },
  };

  if (query) {
    and.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        {
          organization: {
            organizationName: { contains: query, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (category) where.category = category;
  if (filters.participationMode === "online") {
    where.participationMode = { in: ["online", "hybrid"] };
  } else if (filters.participationMode === "offline") {
    where.participationMode = { in: ["offline", "hybrid"] };
  } else if (filters.participationMode === "hybrid") {
    where.participationMode = "hybrid";
  }
  if (filters.beginner) {
    and.push({
      OR: [
        { requiredQualifications: { equals: Prisma.JsonNull } },
        { requiredQualifications: { equals: [] } },
      ],
    });
  }
  if (filters.schedule === "weekend") {
    and.push({
      OR: [{ startDate: { not: null } }, { endDate: { not: null } }],
    });
  }
  if (and.length > 0) where.AND = and;

  const opportunities = await prisma.opportunity.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      category: true,
      participationMode: true,
      startDate: true,
      endDate: true,
      capacity: true,
      currentApplicants: true,
      organization: {
        select: { organizationName: true, activityAreas: true },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
  });

  const filtered = opportunities.filter((opportunity) => {
    if (
      region &&
      !opportunity.location?.toLowerCase().includes(region.toLowerCase())
    ) {
      const areas = Array.isArray(opportunity.organization.activityAreas)
        ? opportunity.organization.activityAreas
        : [];
      const matchesArea = areas.some(
        (area) =>
          typeof area === "string" &&
          area.toLowerCase().includes(region.toLowerCase())
      );
      if (!matchesArea) return false;
    }
    if (filters.schedule === "weekend") {
      return includesWeekend(opportunity.startDate, opportunity.endDate);
    }
    return true;
  });

  return filtered.map((opportunity) => ({
    id: opportunity.id,
    title: opportunity.title,
    description: opportunity.description,
    organizationName: opportunity.organization.organizationName,
    location: opportunity.location,
    category: opportunity.category,
    participationMode: opportunity.participationMode,
    startDate: opportunity.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: opportunity.endDate?.toISOString().slice(0, 10) ?? null,
    capacity: opportunity.capacity,
    currentApplicants: opportunity.currentApplicants,
    badges: getOpportunityBadges(opportunity, now),
  }));
}

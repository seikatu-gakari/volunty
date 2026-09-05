import "server-only";

import { after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { isDomainScores } from "@/lib/diagnosis-scale/scoring";
import { prisma } from "@/lib/prisma";
import {
  MATCHING_RULE_VERSION,
  filterEligibleOpportunities,
  rankOpportunities,
} from "./engine";
import type { OpportunityFeatures, ParticipantFeatures } from "./engine";
import { toActivityStyleTagIds } from "./activity-style-tags";
import type {
  OpportunityRecommendation,
  RecommendationFilters,
  RecommendationResult,
} from "./types";

function normalizeFilterValue(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function matchesCategory(category: string | null, filter: string): boolean {
  return category === filter;
}

function matchesRegion(location: string | null, activityAreas: unknown, region: string): boolean {
  return (
    (location?.includes(region) ?? false) ||
    toStringArray(activityAreas).some((area) => area.includes(region))
  );
}

function normalizeParticipationMode(
  value?: string,
): RecommendationFilters["participationMode"] | null {
  return value === "online" || value === "offline" ? value : null;
}

function matchesParticipationMode(
  participationMode: string | null,
  filter: NonNullable<RecommendationFilters["participationMode"]>,
): boolean {
  return participationMode === "hybrid" || participationMode === filter;
}

function toAgeYears(birthday: Date | null, now: Date): number | null {
  if (!birthday) return null;
  const age =
    now.getFullYear() -
    birthday.getFullYear() -
    (now.getMonth() < birthday.getMonth() ||
    (now.getMonth() === birthday.getMonth() && now.getDate() < birthday.getDate())
      ? 1
      : 0);
  return age >= 0 ? age : null;
}

function toAvailabilityWeekdays(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return toStringArray((value as Record<string, unknown>).weekdays);
}

/** 検証済み参加者へのおすすめを取得し、表示ログは非同期で記録する。 */
export async function fetchRecommendations(
  userId: string,
  filters?: RecommendationFilters,
): Promise<RecommendationResult> {
  try {
    const [participant, opportunities] = await Promise.all([
      prisma.participantProfile.findUnique({
        where: { userId },
        select: {
          interests: true,
          region: true,
          availability: true,
          birthday: true,
          latestDiagnosisResult: { select: { id: true, scaledScores: true } },
        },
      }),
      prisma.opportunity.findMany({
        where: { status: "published" },
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          category: true,
          participationMode: true,
          activityStyleTags: true,
          startDate: true,
          endDate: true,
          publishedAt: true,
          capacity: true,
          currentApplicants: true,
          minAge: true,
          maxAge: true,
          organization: { select: { organizationName: true, activityAreas: true } },
        },
      }),
    ]);

    if (!participant) return { recommendations: [], hasCompletedDiagnosis: false };

    const latestDiagnosis = participant.latestDiagnosisResult;
    const scaledScores =
      latestDiagnosis && isDomainScores(latestDiagnosis.scaledScores)
        ? latestDiagnosis.scaledScores
        : null;
    const hasCompletedDiagnosis = scaledScores !== null;
    const now = new Date();
    const participantFeatures: ParticipantFeatures = {
      interests: toStringArray(participant.interests),
      region: participant.region || null,
      availabilityWeekdays: toAvailabilityWeekdays(participant.availability),
      preferredParticipationMode: null,
      scaledScores,
      ageYears: toAgeYears(participant.birthday, now),
    };
    const categoryFilter = normalizeFilterValue(filters?.category);
    const regionFilter = normalizeFilterValue(filters?.region);
    const participationModeFilter = normalizeParticipationMode(filters?.participationMode);
    const filteredOpportunities = opportunities.filter((opp) => {
      if (categoryFilter && !matchesCategory(opp.category, categoryFilter)) return false;
      if (regionFilter && !matchesRegion(opp.location, opp.organization.activityAreas, regionFilter)) return false;
      if (participationModeFilter && !matchesParticipationMode(opp.participationMode, participationModeFilter)) return false;
      return true;
    });
    const featureById = new Map(filteredOpportunities.map((opp) => [opp.id, opp]));
    const opportunityFeatures: OpportunityFeatures[] = filteredOpportunities.map((opp) => ({
      id: opp.id,
      category: opp.category,
      location: opp.location,
      organizationActivityAreas: toStringArray(opp.organization.activityAreas),
      participationMode: opp.participationMode,
      startDate: opp.startDate,
      endDate: opp.endDate,
      publishedAt: opp.publishedAt,
      capacity: opp.capacity,
      currentApplicants: opp.currentApplicants,
      activityStyleTags: toActivityStyleTagIds(opp.activityStyleTags),
      minAge: opp.minAge,
      maxAge: opp.maxAge,
    }));
    const { eligible } = filterEligibleOpportunities(participantFeatures, opportunityFeatures, now);
    const ranked = rankOpportunities(participantFeatures, eligible, now);
    const logRows = ranked.map((item, index) => ({
      id: crypto.randomUUID(),
      userId,
      opportunityId: item.opportunityId,
      rank: index + 1,
      totalScore: item.totalScore,
      ruleContributions: item.ruleContributions as unknown as Prisma.InputJsonValue,
      reasons: item.reasons,
      matchingRuleVersion: MATCHING_RULE_VERSION,
      diagnosisResultId: latestDiagnosis?.id ?? null,
    }));
    const logIdByOpportunity = new Map(logRows.map((row) => [row.opportunityId, row.id]));
    if (logRows.length > 0) {
      after(async () => {
        try {
          await prisma.recommendationLog.createMany({ data: logRows });
        } catch (err) {
          console.error("[fetchRecommendations] 推薦ログの記録に失敗:", err);
        }
      });
    }
    const recommendations: OpportunityRecommendation[] = ranked.map((item) => {
      const opp = featureById.get(item.opportunityId);
      return {
        id: item.opportunityId,
        title: opp?.title ?? "",
        description: opp?.description ?? null,
        organizationName: opp?.organization.organizationName ?? "",
        reasons: item.reasons,
        recommendationLogId: logIdByOpportunity.get(item.opportunityId) ?? null,
      };
    });
    return { recommendations, hasCompletedDiagnosis };
  } catch (err) {
    console.error("[fetchRecommendations] 予期しないエラー:", err);
    return { recommendations: [], hasCompletedDiagnosis: false };
  }
}

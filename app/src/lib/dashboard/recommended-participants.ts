import type { BIG5Scores } from "@/lib/personality/types";
import { PERSONALITY_TYPES } from "@/lib/personality/constants";
import { calculateMatchScore } from "@/lib/recommendations/matching";

const BIG5_TRAIT_KEYS = [
  "extraversion",
  "agreeableness",
  "conscientiousness",
  "neuroticism",
  "openness",
] as const;

const BIG5_TRAIT_LABELS: Record<keyof BIG5Scores, string> = {
  agreeableness: "協調性",
  conscientiousness: "誠実性",
  extraversion: "外向性",
  neuroticism: "神経症傾向",
  openness: "開放性",
};

export interface RecommendedParticipantCandidate {
  id: string;
  userId: string;
  name: string;
  region: string;
  interests: unknown;
  availability: unknown;
  preferredLocation: string | null;
  publicProfile: boolean;
  diagnosisType: string | null;
  diagnosisMode: string | null;
  diagnosisScores: unknown;
  bio?: string | null;
}

export interface RecommendedParticipantOpportunity {
  id: string;
  title: string;
  requirementTraits: unknown;
}

export interface RecommendedParticipant {
  id: string;
  userId: string;
  name: string;
  region: string;
  bio: string | null;
  interests: string[];
  availabilitySummary: string[];
  preferredLocation: string | null;
  diagnosisType: string | null;
  diagnosisTypeLabel: string | null;
  diagnosisMode: string | null;
  diagnosisScores: BIG5Scores;
  matchScore: number;
  bestOpportunityId: string;
  bestOpportunityTitle: string;
  matchReasons: string[];
}

function isBIG5Scores(value: unknown): value is BIG5Scores {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return BIG5_TRAIT_KEYS.every((trait) => typeof obj[trait] === "number");
}

function toPartialBIG5Scores(value: unknown): Partial<BIG5Scores> {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;
  const result: Partial<BIG5Scores> = {};

  for (const trait of BIG5_TRAIT_KEYS) {
    const score = obj[trait];
    if (typeof score === "number") {
      result[trait] = score;
    }
  }

  return result;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function summarizeAvailability(value: unknown): string[] {
  if (!value || typeof value !== "object") return toStringArray(value);
  if (Array.isArray(value)) return toStringArray(value);

  const obj = value as Record<string, unknown>;
  const weekdays = toStringArray(obj.weekdays);
  const time = typeof obj.time === "string" ? obj.time : null;
  return [
    ...(weekdays.length > 0 ? [`${weekdays.join("・")}曜`] : []),
    ...(time ? [time] : []),
  ];
}

function resolveDiagnosisTypeLabel(diagnosisType: string | null): string | null {
  if (!diagnosisType) return null;
  return (
    PERSONALITY_TYPES.find((type) => type.id === diagnosisType)?.name ??
    PERSONALITY_TYPES.find((type) => type.name === diagnosisType)?.name ??
    diagnosisType
  );
}

function buildMatchReasons(
  scores: BIG5Scores,
  requirementTraits: Partial<BIG5Scores>
): string[] {
  const reasons = BIG5_TRAIT_KEYS.flatMap((trait) => {
    const required = requirementTraits[trait];
    if (required === undefined) return [];

    const diff = Math.abs(scores[trait] - required);
    if (diff <= 10) {
      return [`${BIG5_TRAIT_LABELS[trait]}が募集条件に近い`];
    }
    return [];
  });

  return reasons.length > 0
    ? reasons
    : ["公開中募集案件の求める特性に基づいて算出しています"];
}

function selectBestMatch(
  scores: BIG5Scores,
  opportunities: RecommendedParticipantOpportunity[]
): {
  bestOpportunityId: string;
  bestOpportunityTitle: string;
  matchReasons: string[];
  matchScore: number;
} | null {
  let best:
    | {
        bestOpportunityId: string;
        bestOpportunityTitle: string;
        matchReasons: string[];
        matchScore: number;
      }
    | null = null;

  for (const opportunity of opportunities) {
    const requirementTraits = toPartialBIG5Scores(opportunity.requirementTraits);
    const matchScore = calculateMatchScore(scores, requirementTraits);
    if (!best || matchScore > best.matchScore) {
      best = {
        bestOpportunityId: opportunity.id,
        bestOpportunityTitle: opportunity.title,
        matchReasons: buildMatchReasons(scores, requirementTraits),
        matchScore,
      };
    }
  }

  return best;
}

export function buildRecommendedParticipants(
  participants: RecommendedParticipantCandidate[],
  opportunities: RecommendedParticipantOpportunity[]
): RecommendedParticipant[] {
  if (opportunities.length === 0) return [];

  return participants
    .flatMap((participant) => {
      if (!participant.publicProfile) return [];
      if (!isBIG5Scores(participant.diagnosisScores)) return [];

      const bestMatch = selectBestMatch(
        participant.diagnosisScores,
        opportunities
      );
      if (!bestMatch) return [];

      return [
        {
          id: participant.id,
          userId: participant.userId,
          name: participant.name,
          region: participant.region,
          bio: participant.bio ?? null,
          interests: toStringArray(participant.interests),
          availabilitySummary: summarizeAvailability(participant.availability),
          preferredLocation: participant.preferredLocation,
          diagnosisType: participant.diagnosisType,
          diagnosisTypeLabel: resolveDiagnosisTypeLabel(
            participant.diagnosisType
          ),
          diagnosisMode: participant.diagnosisMode,
          diagnosisScores: participant.diagnosisScores,
          ...bestMatch,
        },
      ];
    })
    .sort((a, b) => {
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore;
      }

      const nameOrder = a.name.localeCompare(b.name, "ja");
      if (nameOrder !== 0) return nameOrder;

      return a.id.localeCompare(b.id);
    });
}

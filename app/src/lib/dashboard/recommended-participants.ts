import type { DomainScores } from "@/lib/diagnosis-scale/types";
import { isDomainScores } from "@/lib/diagnosis-scale/scoring";
import { findStyleTypeById } from "@/lib/diagnosis-scale/style-types";
import { findActivityStyleTag, toActivityStyleTagIds } from "@/lib/recommendations/activity-style-tags";

/** 性格適合の方向判定閾値（推薦エンジンと同じ値） */
const PERSONALITY_HIGH_THRESHOLD = 60;
const PERSONALITY_LOW_THRESHOLD = 40;

export interface RecommendedParticipantCandidate {
  id: string;
  userId: string;
  name: string;
  region: string;
  interests: unknown;
  availability: unknown;
  preferredLocation: string | null;
  publicProfile: boolean;
  latestDiagnosisResult: {
    styleTypeId: string | null;
    scaledScores: unknown;
  } | null;
  bio?: string | null;
}

export interface RecommendedParticipantOpportunity {
  id: string;
  title: string;
  activityStyleTags: unknown;
}

/**
 * 団体向けのおすすめ参加者。
 * 生の診断スコアは含めない（団体には参考タイプと適合説明のみ開示する）。
 */
export interface RecommendedParticipant {
  id: string;
  userId: string;
  name: string;
  region: string;
  bio: string | null;
  interests: string[];
  availabilitySummary: string[];
  preferredLocation: string | null;
  /** 活動スタイルの参考タイプ名（未診断は null） */
  styleTypeLabel: string | null;
  bestOpportunityId: string;
  bestOpportunityTitle: string;
  matchReasons: string[];
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

/**
 * 案件の活動スタイルタグと参加者の診断スコアの適合数を返す。
 * 加点のみ（逆方向でも減点しない）。
 */
function countMatchedTags(
  scores: DomainScores,
  tagIds: string[]
): { matched: number; total: number; reasons: string[] } {
  const tags = tagIds
    .map((id) => findActivityStyleTag(id))
    .filter((tag): tag is NonNullable<typeof tag> => tag !== undefined);
  const matchedTags = tags.filter((tag) =>
    tag.direction === "high"
      ? scores[tag.domain] >= PERSONALITY_HIGH_THRESHOLD
      : scores[tag.domain] <= PERSONALITY_LOW_THRESHOLD
  );
  return {
    matched: matchedTags.length,
    total: tags.length,
    reasons: matchedTags.map(
      (tag) => `「${tag.label}」の活動スタイルに合う傾向があります`
    ),
  };
}

interface BestMatch {
  bestOpportunityId: string;
  bestOpportunityTitle: string;
  matchReasons: string[];
  fitRatio: number;
}

function selectBestMatch(
  scores: DomainScores | null,
  opportunities: RecommendedParticipantOpportunity[]
): BestMatch | null {
  let best: BestMatch | null = null;

  for (const opportunity of opportunities) {
    const tagIds = toActivityStyleTagIds(opportunity.activityStyleTags);
    let fitRatio = 0;
    let reasons: string[] = [];

    if (scores && tagIds.length > 0) {
      const result = countMatchedTags(scores, tagIds);
      fitRatio = result.total > 0 ? result.matched / result.total : 0;
      reasons = result.reasons;
    }

    if (!best || fitRatio > best.fitRatio) {
      best = {
        bestOpportunityId: opportunity.id,
        bestOpportunityTitle: opportunity.title,
        matchReasons:
          reasons.length > 0
            ? reasons
            : ["公開中募集案件の活動スタイルをもとに表示しています"],
        fitRatio,
      };
    }
  }

  return best;
}

/**
 * 団体向けのおすすめ参加者一覧を構築する（純粋関数）。
 *
 * - 未診断の参加者も除外しない（性格だけで機会を奪わない）
 * - 並び順は活動スタイル適合率の降順 → 名前 → ID（決定的）
 */
export function buildRecommendedParticipants(
  participants: RecommendedParticipantCandidate[],
  opportunities: RecommendedParticipantOpportunity[]
): RecommendedParticipant[] {
  if (opportunities.length === 0) return [];

  return participants
    .flatMap((participant) => {
      if (!participant.publicProfile) return [];

      const scaledScores =
        participant.latestDiagnosisResult &&
        isDomainScores(participant.latestDiagnosisResult.scaledScores)
          ? participant.latestDiagnosisResult.scaledScores
          : null;

      const bestMatch = selectBestMatch(scaledScores, opportunities);
      if (!bestMatch) return [];

      const styleTypeId = participant.latestDiagnosisResult?.styleTypeId ?? null;
      const { fitRatio, ...rest } = bestMatch;

      return [
        {
          participant: {
            id: participant.id,
            userId: participant.userId,
            name: participant.name,
            region: participant.region,
            bio: participant.bio ?? null,
            interests: toStringArray(participant.interests),
            availabilitySummary: summarizeAvailability(participant.availability),
            preferredLocation: participant.preferredLocation,
            styleTypeLabel: styleTypeId
              ? (findStyleTypeById(styleTypeId)?.name ?? null)
              : null,
            ...rest,
          },
          fitRatio,
        },
      ];
    })
    .sort((a, b) => {
      if (a.fitRatio !== b.fitRatio) {
        return b.fitRatio - a.fitRatio;
      }

      const nameOrder = a.participant.name.localeCompare(b.participant.name, "ja");
      if (nameOrder !== 0) return nameOrder;

      return a.participant.id.localeCompare(b.participant.id);
    })
    .map((entry) => entry.participant);
}

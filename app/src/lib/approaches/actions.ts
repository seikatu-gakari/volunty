"use server";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { BIG5Scores } from "@/lib/personality/types";
import { calculateMatchScore } from "@/lib/recommendations/matching";
import type {
  ApproachContact,
  ApproachDetail,
  ApproachListItem,
  ApproachMutationResult,
  ApproachParticipant,
  ApproachResponse,
  ApproachSendDataResult,
  ApproachStatus,
  ApproachableParticipantsResult,
  DashboardApproachesResult,
  MyApproachDetailResult,
  MyApproachesResult,
} from "./types";

const BIG5_TRAIT_KEYS = [
  "extraversion",
  "agreeableness",
  "conscientiousness",
  "neuroticism",
  "openness",
] as const;

interface ApprovedOrganization {
  id: string;
  organizationName: string;
  contactEmail: string | null;
  contactLineId: string | null;
  contactLineUrl: string | null;
}

interface ParticipantRecord {
  id: string;
  userId: string;
  name: string;
  region: string;
  bio: string | null;
  interests: unknown;
  preferredLocation: string | null;
  publicProfile: boolean;
  diagnosisType: string | null;
  diagnosisScores: unknown;
}

interface OrganizationContactRecord {
  organizationName: string;
  contactEmail: string | null;
  contactLineId: string | null;
  contactLineUrl: string | null;
}

interface OpportunityRecord {
  id: string;
  title: string;
  requirementTraits?: unknown;
}

interface ApproachRecord {
  id: string;
  status: string;
  message: string;
  matchScore: number | null;
  createdAt: Date | string;
  respondedAt: Date | string | null;
  opportunity: OpportunityRecord;
  organization?: OrganizationContactRecord;
  participantProfile?: Pick<ParticipantRecord, "id" | "name">;
}

async function getCurrentUserId(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "ログインが必要です" };
  }

  return { userId: user.id };
}

async function fetchApprovedOrganizationProfile(
  userId: string
): Promise<ApprovedOrganization | { error: string }> {
  const organization = await prisma.organizationProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      organizationName: true,
      reviewStatus: true,
      contactEmail: true,
      contactLineId: true,
      contactLineUrl: true,
    },
  });

  if (!organization) {
    return { error: "団体プロフィールが見つかりません" };
  }

  if (organization.reviewStatus !== "approved") {
    return { error: "承認済み団体のみ利用できます" };
  }

  return {
    id: organization.id,
    organizationName: organization.organizationName,
    contactEmail: organization.contactEmail,
    contactLineId: organization.contactLineId,
    contactLineUrl: organization.contactLineUrl,
  };
}

async function fetchParticipantProfileByUserId(
  userId: string
): Promise<{ id: string } | { error: string }> {
  const participant = await prisma.participantProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!participant) {
    return { error: "参加者プロフィールが見つかりません" };
  }

  return participant;
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

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toNullableIsoString(value: Date | string | null): string | null {
  return value ? toIsoString(value) : null;
}

function toApproachStatus(value: string): ApproachStatus {
  if (value === "accepted" || value === "declined") return value;
  return "sent";
}

function mapParticipant(participant: ParticipantRecord): ApproachParticipant {
  return {
    id: participant.id,
    name: participant.name,
    region: participant.region,
    bio: participant.bio,
    interests: toStringArray(participant.interests),
    preferredLocation: participant.preferredLocation,
    diagnosisType: participant.diagnosisType,
  };
}

function buildContact(
  status: ApproachStatus,
  organization: OrganizationContactRecord
): ApproachContact | null {
  if (status !== "accepted") return null;

  return {
    email: organization.contactEmail,
    lineId: organization.contactLineId,
    lineUrl: organization.contactLineUrl,
  };
}

function calculateApproachMatchScore(
  diagnosisScores: unknown,
  requirementTraits: unknown
): number | null {
  if (!isBIG5Scores(diagnosisScores)) return null;

  return calculateMatchScore(
    diagnosisScores,
    toPartialBIG5Scores(requirementTraits)
  );
}

function mapApproachForParticipant(approach: ApproachRecord): ApproachListItem {
  const status = toApproachStatus(approach.status);
  const organization = approach.organization;

  return {
    id: approach.id,
    status,
    message: approach.message,
    matchScore: approach.matchScore,
    createdAt: toIsoString(approach.createdAt),
    respondedAt: toNullableIsoString(approach.respondedAt),
    opportunityId: approach.opportunity.id,
    opportunityTitle: approach.opportunity.title,
    organizationName: organization?.organizationName ?? "団体名未設定",
    contact: organization ? buildContact(status, organization) : null,
  };
}

function mapApproachForDashboard(approach: ApproachRecord): ApproachListItem {
  return {
    id: approach.id,
    status: toApproachStatus(approach.status),
    message: approach.message,
    matchScore: approach.matchScore,
    createdAt: toIsoString(approach.createdAt),
    respondedAt: toNullableIsoString(approach.respondedAt),
    participantProfileId: approach.participantProfile?.id,
    participantName: approach.participantProfile?.name ?? "参加者名未設定",
    opportunityId: approach.opportunity.id,
    opportunityTitle: approach.opportunity.title,
    contact: null,
  };
}

export async function fetchApproachableParticipants(): Promise<ApproachableParticipantsResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { participants: [], error: auth.error };

    const organization = await fetchApprovedOrganizationProfile(auth.userId);
    if ("error" in organization) {
      return { participants: [], error: organization.error };
    }

    const participants = await prisma.participantProfile.findMany({
      where: { publicProfile: true },
      select: {
        id: true,
        userId: true,
        name: true,
        region: true,
        bio: true,
        interests: true,
        preferredLocation: true,
        publicProfile: true,
        diagnosisType: true,
        diagnosisScores: true,
        approaches: {
          where: { organizationId: organization.id },
          select: { id: true },
        },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });

    return {
      participants: participants.map((participant) => ({
        ...mapParticipant(participant),
        sentApproachCount: participant.approaches.length,
      })),
    };
  } catch (err) {
    console.error("[fetchApproachableParticipants] 予期しないエラー:", err);
    return { participants: [], error: "予期しないエラーが発生しました" };
  }
}

export async function fetchApproachSendData(
  participantProfileId: string
): Promise<ApproachSendDataResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) {
      return { participant: null, opportunities: [], error: auth.error };
    }

    const organization = await fetchApprovedOrganizationProfile(auth.userId);
    if ("error" in organization) {
      return {
        participant: null,
        opportunities: [],
        error: organization.error,
      };
    }

    const participant = await prisma.participantProfile.findUnique({
      where: { id: participantProfileId },
      select: {
        id: true,
        userId: true,
        name: true,
        region: true,
        bio: true,
        interests: true,
        preferredLocation: true,
        publicProfile: true,
        diagnosisType: true,
        diagnosisScores: true,
      },
    });

    if (!participant || !participant.publicProfile) {
      return {
        participant: null,
        opportunities: [],
        error: "参加者が見つかりません",
      };
    }

    const [opportunities, approaches] = await Promise.all([
      prisma.opportunity.findMany({
        where: { organizationId: organization.id, status: "published" },
        select: { id: true, title: true, requirementTraits: true },
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.approach.findMany({
        where: {
          organizationId: organization.id,
          participantProfileId,
        },
        select: { opportunityId: true },
      }),
    ]);

    const approachedOpportunityIds = new Set(
      approaches.map((approach) => approach.opportunityId)
    );

    return {
      participant: mapParticipant(participant),
      opportunities: opportunities.map((opportunity) => ({
        id: opportunity.id,
        title: opportunity.title,
        alreadyApproached: approachedOpportunityIds.has(opportunity.id),
      })),
    };
  } catch (err) {
    console.error("[fetchApproachSendData] 予期しないエラー:", err);
    return {
      participant: null,
      opportunities: [],
      error: "予期しないエラーが発生しました",
    };
  }
}

export async function sendApproach(input: {
  participantProfileId: string;
  opportunityId: string;
  message: string;
}): Promise<ApproachMutationResult> {
  const message = input.message.trim();
  if (!message) {
    return {
      success: false,
      error: "アプローチメッセージを入力してください",
    };
  }

  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { success: false, error: auth.error };

    const organization = await fetchApprovedOrganizationProfile(auth.userId);
    if ("error" in organization) {
      return { success: false, error: organization.error };
    }

    const participant = await prisma.participantProfile.findUnique({
      where: { id: input.participantProfileId },
      select: {
        id: true,
        userId: true,
        name: true,
        region: true,
        bio: true,
        interests: true,
        preferredLocation: true,
        publicProfile: true,
        diagnosisType: true,
        diagnosisScores: true,
      },
    });

    if (!participant || !participant.publicProfile) {
      return { success: false, error: "参加者が見つかりません" };
    }

    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: input.opportunityId,
        organizationId: organization.id,
        status: "published",
      },
      select: {
        id: true,
        title: true,
        requirementTraits: true,
      },
    });

    if (!opportunity) {
      return {
        success: false,
        error: "公開中の自団体案件が見つかりません",
      };
    }

    const existing = await prisma.approach.findFirst({
      where: {
        organizationId: organization.id,
        participantProfileId: participant.id,
        opportunityId: opportunity.id,
      },
      select: { id: true },
    });

    if (existing) {
      return {
        success: false,
        error: "この参加者にはこの案件ですでにアプローチ済みです",
      };
    }

    const created = await prisma.approach.create({
      data: {
        organizationId: organization.id,
        participantProfileId: participant.id,
        opportunityId: opportunity.id,
        message,
        matchScore: calculateApproachMatchScore(
          participant.diagnosisScores,
          opportunity.requirementTraits
        ),
      },
      select: { id: true },
    });

    return { success: true, approachId: created.id };
  } catch (err) {
    console.error("[sendApproach] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

export async function fetchDashboardApproaches(): Promise<DashboardApproachesResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { approaches: [], error: auth.error };

    const organization = await fetchApprovedOrganizationProfile(auth.userId);
    if ("error" in organization) {
      return { approaches: [], error: organization.error };
    }

    const approaches = await prisma.approach.findMany({
      where: { organizationId: organization.id },
      select: {
        id: true,
        status: true,
        message: true,
        matchScore: true,
        createdAt: true,
        respondedAt: true,
        participantProfile: {
          select: { id: true, name: true },
        },
        opportunity: {
          select: { id: true, title: true },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return {
      approaches: approaches.map(mapApproachForDashboard),
    };
  } catch (err) {
    console.error("[fetchDashboardApproaches] 予期しないエラー:", err);
    return { approaches: [], error: "予期しないエラーが発生しました" };
  }
}

export async function fetchMyApproaches(): Promise<MyApproachesResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { approaches: [], error: auth.error };

    const participant = await fetchParticipantProfileByUserId(auth.userId);
    if ("error" in participant) {
      return { approaches: [], error: participant.error };
    }

    const approaches = await prisma.approach.findMany({
      where: { participantProfileId: participant.id },
      select: {
        id: true,
        status: true,
        message: true,
        matchScore: true,
        createdAt: true,
        respondedAt: true,
        opportunity: {
          select: { id: true, title: true },
        },
        organization: {
          select: {
            organizationName: true,
            contactEmail: true,
            contactLineId: true,
            contactLineUrl: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return {
      approaches: approaches.map(mapApproachForParticipant),
    };
  } catch (err) {
    console.error("[fetchMyApproaches] 予期しないエラー:", err);
    return { approaches: [], error: "予期しないエラーが発生しました" };
  }
}

export async function fetchMyApproachDetail(
  approachId: string
): Promise<MyApproachDetailResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { approach: null, error: auth.error };

    const participant = await fetchParticipantProfileByUserId(auth.userId);
    if ("error" in participant) {
      return { approach: null, error: participant.error };
    }

    const approach = await prisma.approach.findFirst({
      where: {
        id: approachId,
        participantProfileId: participant.id,
      },
      select: {
        id: true,
        status: true,
        message: true,
        matchScore: true,
        createdAt: true,
        respondedAt: true,
        opportunity: {
          select: { id: true, title: true },
        },
        organization: {
          select: {
            organizationName: true,
            contactEmail: true,
            contactLineId: true,
            contactLineUrl: true,
          },
        },
      },
    });

    if (!approach) {
      return { approach: null, error: "アプローチが見つかりません" };
    }

    return {
      approach: mapApproachForParticipant(approach) as ApproachDetail,
    };
  } catch (err) {
    console.error("[fetchMyApproachDetail] 予期しないエラー:", err);
    return { approach: null, error: "予期しないエラーが発生しました" };
  }
}

export async function respondToApproach(
  approachId: string,
  response: ApproachResponse
): Promise<ApproachMutationResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { success: false, error: auth.error };

    const participant = await fetchParticipantProfileByUserId(auth.userId);
    if ("error" in participant) {
      return { success: false, error: participant.error };
    }

    const approach = await prisma.approach.findFirst({
      where: {
        id: approachId,
        participantProfileId: participant.id,
      },
      select: { id: true, status: true },
    });

    if (!approach) {
      return { success: false, error: "アプローチが見つかりません" };
    }

    if (approach.status !== "sent") {
      return {
        success: false,
        error: "このアプローチはすでに回答済みです",
      };
    }

    const updated = await prisma.approach.update({
      where: { id: approach.id },
      data: {
        status: response,
        respondedAt: new Date(),
      },
      select: { id: true },
    });

    return { success: true, approachId: updated.id };
  } catch (err) {
    console.error("[respondToApproach] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

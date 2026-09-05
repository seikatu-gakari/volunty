import "server-only";

import { prisma } from "@/lib/prisma";
import { findStyleTypeById } from "@/lib/diagnosis-scale/style-types";
import type {
  ApproachContact,
  ApproachDetail,
  ApproachListItem,
  ApproachMessageTemplate,
  ApproachParticipant,
  ApproachSendDataResult,
  ApproachStatus,
  DashboardApproachesResult,
  MyApproachDetailResult,
  MyApproachesResult,
} from "./types";

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
  latestDiagnosisResult: { styleTypeId: string | null } | null;
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
}

interface ApproachRecord {
  id: string;
  status: string;
  message: string;
  createdAt: Date | string;
  expiresAt: Date | string;
  respondedAt: Date | string | null;
  opportunity: OpportunityRecord;
  organization?: OrganizationContactRecord;
  participantProfile?: Pick<ParticipantRecord, "id" | "name">;
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
  if (!organization) return { error: "団体プロフィールが見つかりません" };
  if (organization.reviewStatus !== "approved") {
    return { error: "承認済み団体のみ利用できます" };
  }
  return organization;
}

async function fetchParticipantProfileByUserId(
  userId: string
): Promise<{ id: string } | { error: string }> {
  const participant = await prisma.participantProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return participant ?? { error: "参加者プロフィールが見つかりません" };
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

function isApproachExpired(
  status: ApproachStatus,
  expiresAt: Date | string,
  now = new Date()
): boolean {
  return status === "sent" && new Date(expiresAt).getTime() < now.getTime();
}

function hasContact(contact: ApproachContact | null): boolean {
  return Boolean(contact?.email || contact?.lineId || contact?.lineUrl);
}

function mapParticipant(participant: ParticipantRecord): ApproachParticipant {
  const styleTypeId = participant.latestDiagnosisResult?.styleTypeId ?? null;
  return {
    id: participant.id,
    name: participant.name,
    region: participant.region,
    bio: participant.bio,
    interests: toStringArray(participant.interests),
    preferredLocation: participant.preferredLocation,
    styleTypeLabel: styleTypeId
      ? (findStyleTypeById(styleTypeId)?.name ?? null)
      : null,
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

function mapApproachForParticipant(approach: ApproachRecord): ApproachListItem {
  const status = toApproachStatus(approach.status);
  const organization = approach.organization;
  const contact = organization ? buildContact(status, organization) : null;
  return {
    id: approach.id,
    status,
    message: approach.message,
    createdAt: toIsoString(approach.createdAt),
    expiresAt: toIsoString(approach.expiresAt),
    respondedAt: toNullableIsoString(approach.respondedAt),
    isExpired: isApproachExpired(status, approach.expiresAt),
    opportunityId: approach.opportunity.id,
    opportunityTitle: approach.opportunity.title,
    organizationName: organization?.organizationName ?? "団体名未設定",
    contact,
    hasContact: hasContact(contact),
  };
}

function mapApproachForDashboard(approach: ApproachRecord): ApproachListItem {
  const status = toApproachStatus(approach.status);
  return {
    id: approach.id,
    status,
    message: approach.message,
    createdAt: toIsoString(approach.createdAt),
    expiresAt: toIsoString(approach.expiresAt),
    respondedAt: toNullableIsoString(approach.respondedAt),
    isExpired: isApproachExpired(status, approach.expiresAt),
    participantProfileId: approach.participantProfile?.id,
    participantName: approach.participantProfile?.name ?? "参加者名未設定",
    opportunityId: approach.opportunity.id,
    opportunityTitle: approach.opportunity.title,
    contact: null,
    hasContact: false,
  };
}

function mapTemplate(template: ApproachMessageTemplate): ApproachMessageTemplate {
  return { id: template.id, name: template.name, body: template.body };
}

/** 検証済み承認団体がアプローチ送信フォーム用データを取得する。 */
export async function fetchApproachSendDataQuery(
  userId: string,
  participantProfileId: string
): Promise<ApproachSendDataResult> {
  try {
    const organization = await fetchApprovedOrganizationProfile(userId);
    if ("error" in organization) {
      return { participant: null, opportunities: [], templates: [], error: organization.error };
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
        latestDiagnosisResult: { select: { styleTypeId: true } },
      },
    });
    if (!participant || !participant.publicProfile) {
      return { participant: null, opportunities: [], templates: [], error: "参加者が見つかりません" };
    }
    const [opportunities, approaches, templates] = await Promise.all([
      prisma.opportunity.findMany({
        where: { organizationId: organization.id, status: "published" },
        select: { id: true, title: true },
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.approach.findMany({
        where: { organizationId: organization.id, participantProfileId },
        select: { opportunityId: true },
      }),
      prisma.messageTemplate.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true, body: true },
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
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
      templates: templates.map(mapTemplate),
    };
  } catch (error) {
    console.error("[fetchApproachSendDataQuery] 予期しないエラー:", error);
    return {
      participant: null,
      opportunities: [],
      templates: [],
      error: "予期しないエラーが発生しました",
    };
  }
}

/** 検証済み承認団体のアプローチ送信履歴を取得する。 */
export async function fetchDashboardApproachesQuery(
  userId: string
): Promise<DashboardApproachesResult> {
  try {
    const organization = await fetchApprovedOrganizationProfile(userId);
    if ("error" in organization) return { approaches: [], error: organization.error };
    const approaches = await prisma.approach.findMany({
      where: { organizationId: organization.id },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        expiresAt: true,
        respondedAt: true,
        participantProfile: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    return { approaches: approaches.map(mapApproachForDashboard) };
  } catch (error) {
    console.error("[fetchDashboardApproachesQuery] 予期しないエラー:", error);
    return { approaches: [], error: "予期しないエラーが発生しました" };
  }
}

/** 検証済み参加者の受信アプローチ一覧を取得する。 */
export async function fetchMyApproachesQuery(
  userId: string
): Promise<MyApproachesResult> {
  try {
    const participant = await fetchParticipantProfileByUserId(userId);
    if ("error" in participant) return { approaches: [], error: participant.error };
    const approaches = await prisma.approach.findMany({
      where: { participantProfileId: participant.id },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        expiresAt: true,
        respondedAt: true,
        opportunity: { select: { id: true, title: true } },
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
    return { approaches: approaches.map(mapApproachForParticipant) };
  } catch (error) {
    console.error("[fetchMyApproachesQuery] 予期しないエラー:", error);
    return { approaches: [], error: "予期しないエラーが発生しました" };
  }
}

/** 検証済み参加者の受信アプローチ詳細を取得する。 */
export async function fetchMyApproachDetailQuery(
  userId: string,
  approachId: string
): Promise<MyApproachDetailResult> {
  try {
    const participant = await fetchParticipantProfileByUserId(userId);
    if ("error" in participant) return { approach: null, error: participant.error };
    const approach = await prisma.approach.findFirst({
      where: { id: approachId, participantProfileId: participant.id },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        expiresAt: true,
        respondedAt: true,
        opportunity: { select: { id: true, title: true } },
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
    if (!approach) return { approach: null, error: "アプローチが見つかりません" };
    return { approach: mapApproachForParticipant(approach) as ApproachDetail };
  } catch (error) {
    console.error("[fetchMyApproachDetailQuery] 予期しないエラー:", error);
    return { approach: null, error: "予期しないエラーが発生しました" };
  }
}

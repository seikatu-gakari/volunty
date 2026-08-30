import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CertificateDetailResult,
  CertificateListItem,
  CertificateReference,
  CertificateRequestTarget,
  CertificateRequestTargetResult,
  CertificatesResult,
  CertificateStatus,
} from "./types";

const completedApplicationSelect = {
  id: true,
  participantId: true,
  opportunityId: true,
  status: true,
  statusChangedAt: true,
  participant: {
    select: { id: true, participantProfile: { select: { name: true } } },
  },
  opportunity: {
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      organizationId: true,
      organization: { select: { id: true, organizationName: true } },
    },
  },
} satisfies Prisma.MatchingCandidateSelect;

const certificateSelect = {
  id: true,
  applicationId: true,
  participantId: true,
  organizationId: true,
  opportunityId: true,
  status: true,
  certificateNumber: true,
  requestedAt: true,
  approvedAt: true,
  issuedAt: true,
  rejectedAt: true,
  rejectionReason: true,
  application: { select: { id: true, status: true, statusChangedAt: true } },
  participant: {
    select: { id: true, participantProfile: { select: { name: true } } },
  },
  organization: { select: { id: true, organizationName: true } },
  opportunity: {
    select: { id: true, title: true, startDate: true, endDate: true },
  },
} satisfies Prisma.CertificateSelect;

type CompletedApplicationRecord = Prisma.MatchingCandidateGetPayload<{
  select: typeof completedApplicationSelect;
}>;
type CertificateRecord = Prisma.CertificateGetPayload<{
  select: typeof certificateSelect;
}>;

async function fetchApprovedOrganizationProfile(
  userId: string
): Promise<{ id: string } | { error: string }> {
  const organization = await prisma.organizationProfile.findUnique({
    where: { userId },
    select: { id: true, reviewStatus: true },
  });
  if (!organization) return { error: "団体プロフィールが見つかりません" };
  if (organization.reviewStatus !== "approved") {
    return { error: "承認済み団体のみ利用できます" };
  }
  return { id: organization.id };
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function formatDateJa(value: Date | string | null): string {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function buildActivityDateLabel({
  startDate,
  endDate,
  completedAt,
}: {
  startDate: Date | string | null;
  endDate: Date | string | null;
  completedAt: Date | string | null;
}) {
  if (startDate && endDate) {
    const start = formatDateJa(startDate);
    const end = formatDateJa(endDate);
    return start === end ? start : `${start}〜${end}`;
  }
  if (startDate) return formatDateJa(startDate);
  if (endDate) return formatDateJa(endDate);
  return formatDateJa(completedAt);
}

function toCertificateStatus(status: string): CertificateStatus {
  if (status === "issued" || status === "rejected") return status;
  return "pending";
}

function mapCertificateReference(
  certificate: Pick<CertificateRecord, "id" | "status"> | null
): CertificateReference | null {
  if (!certificate) return null;
  return { id: certificate.id, status: toCertificateStatus(certificate.status) };
}

function mapRequestTarget(
  application: CompletedApplicationRecord,
  existingCertificate: CertificateReference | null
): CertificateRequestTarget {
  const completedAt = toIso(application.statusChangedAt) ?? "";
  return {
    applicationId: application.id,
    participantName: application.participant.participantProfile?.name ?? "不明",
    organizationName: application.opportunity.organization.organizationName,
    opportunityTitle: application.opportunity.title,
    completedAt,
    activityDateLabel: buildActivityDateLabel({
      startDate: application.opportunity.startDate,
      endDate: application.opportunity.endDate,
      completedAt: application.statusChangedAt,
    }),
    existingCertificate,
  };
}

function mapCertificate(record: CertificateRecord): CertificateListItem {
  const completedAt = toIso(record.application.statusChangedAt) ?? "";
  return {
    id: record.id,
    applicationId: record.applicationId,
    status: toCertificateStatus(record.status),
    certificateNumber: record.certificateNumber,
    requestedAt: toIso(record.requestedAt) ?? "",
    approvedAt: toIso(record.approvedAt),
    issuedAt: toIso(record.issuedAt),
    rejectedAt: toIso(record.rejectedAt),
    rejectionReason: record.rejectionReason,
    participantName: record.participant.participantProfile?.name ?? "不明",
    organizationName: record.organization.organizationName,
    opportunityTitle: record.opportunity.title,
    completedAt,
    activityDateLabel: buildActivityDateLabel({
      startDate: record.opportunity.startDate,
      endDate: record.opportunity.endDate,
      completedAt: record.application.statusChangedAt,
    }),
  };
}

/** 検証済み参加者の証明書申請対象を取得する。 */
export async function fetchCertificateRequestTargetQuery(
  userId: string,
  applicationId: string
): Promise<CertificateRequestTargetResult> {
  try {
    const application = await prisma.matchingCandidate.findFirst({
      where: { id: applicationId, participantId: userId, status: "completed" },
      select: completedApplicationSelect,
    });
    if (!application) {
      return {
        target: null,
        error: "活動完了済みの応募のみ証明書を申請できます",
      };
    }
    const existing = await prisma.certificate.findUnique({
      where: { applicationId },
      select: { id: true, status: true },
    });
    return {
      target: mapRequestTarget(application, mapCertificateReference(existing)),
    };
  } catch (error) {
    console.error("[fetchCertificateRequestTargetQuery] 予期しないエラー:", error);
    return { target: null, error: "予期しないエラーが発生しました" };
  }
}

/** 検証済み参加者の証明書一覧を取得する。 */
export async function fetchMyCertificatesQuery(
  userId: string
): Promise<CertificatesResult> {
  try {
    const certificates = await prisma.certificate.findMany({
      where: { participantId: userId },
      select: certificateSelect,
      orderBy: [{ requestedAt: "desc" }],
    });
    return { certificates: certificates.map(mapCertificate) };
  } catch (error) {
    console.error("[fetchMyCertificatesQuery] 予期しないエラー:", error);
    return { certificates: [], error: "予期しないエラーが発生しました" };
  }
}

/** 検証済み承認団体の証明書一覧を取得する。 */
export async function fetchDashboardCertificatesQuery(
  userId: string
): Promise<CertificatesResult> {
  try {
    const organization = await fetchApprovedOrganizationProfile(userId);
    if ("error" in organization) return { certificates: [], error: organization.error };
    const certificates = await prisma.certificate.findMany({
      where: { organizationId: organization.id },
      select: certificateSelect,
      orderBy: [{ requestedAt: "desc" }],
    });
    return { certificates: certificates.map(mapCertificate) };
  } catch (error) {
    console.error("[fetchDashboardCertificatesQuery] 予期しないエラー:", error);
    return { certificates: [], error: "予期しないエラーが発生しました" };
  }
}

/** 検証済み参加者の証明書詳細を取得する。 */
export async function fetchParticipantCertificateDetailQuery(
  userId: string,
  certificateId: string
): Promise<CertificateDetailResult> {
  try {
    const certificate = await prisma.certificate.findFirst({
      where: { id: certificateId, participantId: userId },
      select: certificateSelect,
    });
    if (!certificate) return { certificate: null, error: "証明書が見つかりません" };
    return { certificate: mapCertificate(certificate) };
  } catch (error) {
    console.error("[fetchParticipantCertificateDetailQuery] 予期しないエラー:", error);
    return { certificate: null, error: "予期しないエラーが発生しました" };
  }
}

/** 検証済み承認団体の証明書詳細を取得する。 */
export async function fetchDashboardCertificateDetailQuery(
  userId: string,
  certificateId: string
): Promise<CertificateDetailResult> {
  try {
    const organization = await fetchApprovedOrganizationProfile(userId);
    if ("error" in organization) return { certificate: null, error: organization.error };
    const certificate = await prisma.certificate.findFirst({
      where: { id: certificateId, organizationId: organization.id },
      select: certificateSelect,
    });
    if (!certificate) {
      return { certificate: null, error: "証明書申請が見つかりません" };
    }
    return { certificate: mapCertificate(certificate) };
  } catch (error) {
    console.error("[fetchDashboardCertificateDetailQuery] 予期しないエラー:", error);
    return { certificate: null, error: "予期しないエラーが発生しました" };
  }
}

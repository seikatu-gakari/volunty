"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  fetchCertificateRequestTargetQuery,
  fetchDashboardCertificateDetailQuery,
  fetchDashboardCertificatesQuery,
  fetchMyCertificatesQuery,
  fetchParticipantCertificateDetailQuery,
} from "./queries";
import type {
  CertificateDetailResult,
  CertificateListItem,
  CertificateMutationResult,
  CertificatePdfDataResult,
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
    select: {
      id: true,
      participantProfile: {
        select: {
          name: true,
        },
      },
    },
  },
  opportunity: {
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      organizationId: true,
      organization: {
        select: {
          id: true,
          organizationName: true,
        },
      },
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
  application: {
    select: {
      id: true,
      status: true,
      statusChangedAt: true,
    },
  },
  participant: {
    select: {
      id: true,
      participantProfile: {
        select: {
          name: true,
        },
      },
    },
  },
  organization: {
    select: {
      id: true,
      organizationName: true,
    },
  },
  opportunity: {
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
    },
  },
} satisfies Prisma.CertificateSelect;

type CertificateRecord = Prisma.CertificateGetPayload<{
  select: typeof certificateSelect;
}>;

type CurrentOrganization =
  | {
      id: string;
      organizationName: string;
    }
  | { error: string };

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

async function getCurrentUserRole(
  userId: string
): Promise<"participant" | "organization" | "admin" | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role ?? null;
}

async function fetchApprovedOrganizationProfile(
  userId: string
): Promise<CurrentOrganization> {
  const organization = await prisma.organizationProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      organizationName: true,
      reviewStatus: true,
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
  };
}

async function fetchCompletedApplicationForParticipant(
  applicationId: string,
  participantId: string
) {
  return prisma.matchingCandidate.findFirst({
    where: {
      id: applicationId,
      participantId,
      status: "completed",
    },
    select: completedApplicationSelect,
  });
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

function generateCertificateNumber(certificateId: string, issuedAt: Date) {
  const datePart = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(issuedAt)
    .replaceAll("-", "");
  const suffix = certificateId.replaceAll("-", "").slice(0, 8).toUpperCase();

  return `VOL-${datePart}-${suffix}`;
}

function revalidateCertificateViews(certificateId?: string) {
  revalidatePath("/mypage");
  revalidatePath("/mypage/certificates");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/certificates");
  if (certificateId) {
    revalidatePath(`/mypage/certificates/${certificateId}`);
    revalidatePath(`/dashboard/certificates/${certificateId}`);
  }
}

export async function fetchCertificateRequestTarget(
  applicationId: string
): Promise<CertificateRequestTargetResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { target: null, error: auth.error };
    return fetchCertificateRequestTargetQuery(auth.userId, applicationId);
  } catch (err) {
    console.error("[fetchCertificateRequestTarget] 予期しないエラー:", err);
    return { target: null, error: "予期しないエラーが発生しました" };
  }
}

export async function requestCertificate(
  applicationId: string
): Promise<CertificateMutationResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { success: false, error: auth.error };

    const application = await fetchCompletedApplicationForParticipant(
      applicationId,
      auth.userId
    );

    if (!application) {
      return {
        success: false,
        error: "活動完了済みの応募のみ証明書を申請できます",
      };
    }

    const existing = await prisma.certificate.findUnique({
      where: { applicationId },
      select: { id: true, status: true },
    });

    if (existing) {
      return {
        success: false,
        error: "この応募の証明書はすでに申請済みです",
      };
    }

    const created = await prisma.certificate.create({
      data: {
        applicationId: application.id,
        participantId: application.participantId,
        organizationId: application.opportunity.organizationId,
        opportunityId: application.opportunityId,
        status: "pending",
      },
      select: { id: true },
    });

    revalidateCertificateViews(created.id);
    return { success: true, certificateId: created.id };
  } catch (err) {
    console.error("[requestCertificate] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

export async function fetchMyCertificates(): Promise<CertificatesResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { certificates: [], error: auth.error };
    return fetchMyCertificatesQuery(auth.userId);
  } catch (err) {
    console.error("[fetchMyCertificates] 予期しないエラー:", err);
    return { certificates: [], error: "予期しないエラーが発生しました" };
  }
}

export async function fetchDashboardCertificates(): Promise<CertificatesResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { certificates: [], error: auth.error };
    return fetchDashboardCertificatesQuery(auth.userId);
  } catch (err) {
    console.error("[fetchDashboardCertificates] 予期しないエラー:", err);
    return { certificates: [], error: "予期しないエラーが発生しました" };
  }
}

export async function fetchParticipantCertificateDetail(
  certificateId: string
): Promise<CertificateDetailResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { certificate: null, error: auth.error };
    return fetchParticipantCertificateDetailQuery(auth.userId, certificateId);
  } catch (err) {
    console.error("[fetchParticipantCertificateDetail] 予期しないエラー:", err);
    return { certificate: null, error: "予期しないエラーが発生しました" };
  }
}

export async function fetchDashboardCertificateDetail(
  certificateId: string
): Promise<CertificateDetailResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { certificate: null, error: auth.error };
    return fetchDashboardCertificateDetailQuery(auth.userId, certificateId);
  } catch (err) {
    console.error("[fetchDashboardCertificateDetail] 予期しないエラー:", err);
    return { certificate: null, error: "予期しないエラーが発生しました" };
  }
}

export async function approveCertificate(
  certificateId: string
): Promise<CertificateMutationResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { success: false, error: auth.error };

    const organization = await fetchApprovedOrganizationProfile(auth.userId);
    if ("error" in organization) {
      return { success: false, error: organization.error };
    }

    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      select: certificateSelect,
    });

    if (!certificate) {
      return { success: false, error: "証明書申請が見つかりません" };
    }

    if (certificate.organizationId !== organization.id) {
      return { success: false, error: "この操作を行う権限がありません" };
    }

    if (certificate.status !== "pending") {
      return { success: false, error: "処理済みの申請は承認できません" };
    }

    const now = new Date();
    const updated = await prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        status: "issued",
        approvedAt: now,
        issuedAt: now,
        certificateNumber: generateCertificateNumber(certificate.id, now),
        rejectedAt: null,
        rejectionReason: null,
      },
      select: { id: true },
    });

    revalidateCertificateViews(updated.id);
    return { success: true, certificateId: updated.id };
  } catch (err) {
    console.error("[approveCertificate] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

export async function rejectCertificate(
  certificateId: string,
  reason: string
): Promise<CertificateMutationResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { success: false, error: auth.error };

    const organization = await fetchApprovedOrganizationProfile(auth.userId);
    if ("error" in organization) {
      return { success: false, error: organization.error };
    }

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      return { success: false, error: "却下理由を入力してください" };
    }

    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      select: certificateSelect,
    });

    if (!certificate) {
      return { success: false, error: "証明書申請が見つかりません" };
    }

    if (certificate.organizationId !== organization.id) {
      return { success: false, error: "この操作を行う権限がありません" };
    }

    if (certificate.status !== "pending") {
      return { success: false, error: "処理済みの申請は却下できません" };
    }

    const updated = await prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        status: "rejected",
        rejectedAt: new Date(),
        rejectionReason: normalizedReason,
      },
      select: { id: true },
    });

    revalidateCertificateViews(updated.id);
    return { success: true, certificateId: updated.id };
  } catch (err) {
    console.error("[rejectCertificate] 予期しないエラー:", err);
    return { success: false, error: "予期しないエラーが発生しました" };
  }
}

export async function fetchIssuedCertificateForPdf(
  certificateId: string
): Promise<CertificatePdfDataResult> {
  try {
    const auth = await getCurrentUserId();
    if ("error" in auth) return { certificate: null, error: auth.error };

    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      select: certificateSelect,
    });

    if (
      !certificate ||
      certificate.status !== "issued" ||
      !certificate.issuedAt ||
      !certificate.certificateNumber
    ) {
      return { certificate: null, error: "発行済み証明書が見つかりません" };
    }

    const role = await getCurrentUserRole(auth.userId);
    const isParticipantOwner = certificate.participantId === auth.userId;
    let isOrganizationOwner = false;

    if (!isParticipantOwner && role !== "admin") {
      const organization = await fetchApprovedOrganizationProfile(auth.userId);
      isOrganizationOwner =
        !("error" in organization) && organization.id === certificate.organizationId;
    }

    if (!isParticipantOwner && !isOrganizationOwner && role !== "admin") {
      return { certificate: null, error: "この操作を行う権限がありません" };
    }

    const mapped = mapCertificate(certificate);
    return {
      certificate: {
        ...mapped,
        certificateNumber: certificate.certificateNumber,
        issuedAtLabel: formatDateJa(certificate.issuedAt),
      },
    };
  } catch (err) {
    console.error("[fetchIssuedCertificateForPdf] 予期しないエラー:", err);
    return { certificate: null, error: "予期しないエラーが発生しました" };
  }
}
